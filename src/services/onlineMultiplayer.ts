/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  getEstimatedServerNow,
  handleFirestoreError,
  OperationType,
  reportServerError,
  updateServerClockOffsetFromMillis,
} from './firebase';
import {
  createInitialGameState,
  createToken,
  executeMove,
  getValidMoves,
} from '../utils/ludoEngine';
import {
  GameState,
  MoveAnimationData,
  Player,
  PlayerColor,
  RoomParticipant,
  RoomState,
} from '../types/ludo';

const TURN_TIMEOUT_MS = 15_000;
const QUEUE_TTL_MS = 45_000;
export const PRESENCE_DISCONNECT_GRACE_MS = 12_000;

export class RoomJoinError extends Error {
  code:
    | 'INVALID_CODE'
    | 'NOT_FOUND'
    | 'ROOM_FULL'
    | 'ALREADY_STARTED'
    | 'ROOM_CLOSED'
    | 'ALREADY_JOINED'
    | 'CONNECTION_ERROR'
    | 'AUTH_REQUIRED';

  constructor(code: RoomJoinError['code'], message: string) {
    super(message);
    this.name = 'RoomJoinError';
    this.code = code;
  }
}

export const ROOM_JOIN_MESSAGES = {
  INVALID_CODE: 'Invalid room code. Please check your code and try again.',
  NOT_FOUND:
    'Room not found! Please double-check the code or ask your friend for a new one.',
  ROOM_FULL: 'This room is full. Please try joining another room.',
  ALREADY_STARTED:
    'This match has already started. You can no longer join this room.',
  ROOM_CLOSED:
    'This room is no longer available. Ask your friend to create a new room.',
  CONNECTION_ERROR:
    'Connection failed. Please check your internet connection and try again.',
  ALREADY_JOINED: "You're already in this room!",
} as const;

function sanitizeId(raw: string, fallbackPrefix = 'usr'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 76);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function sanitizeName(raw: string | undefined, fallback?: string): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  const defaultGuest =
    fallback || `Player${Math.floor(1000 + Math.random() * 9000)}`;
  return (trimmed || defaultGuest).slice(0, 18);
}

function generateTurnId(now: number): string {
  return `turn_${now}_${Math.random().toString(36).substring(2, 7)}`;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MUDO-${rand}`;
}

export function normalizeAndValidateRoomCode(rawInput: string): string {
  const compact = rawInput.trim().toUpperCase().replace(/\s+/g, '');
  const matched = compact.match(/^MUDO-?([A-Z0-9]{4})$/);
  if (!matched) {
    throw new RoomJoinError('INVALID_CODE', ROOM_JOIN_MESSAGES.INVALID_CODE);
  }
  return `MUDO-${matched[1]}`;
}

function isNetworkOrUnavailableError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('unavailable')
  );
}

function isPermissionError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return code === 'permission-denied' || msg.includes('missing or insufficient permissions');
}

function requireVerifiedAuthUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Online session is still initializing. Please try again in a moment.');
  }
  return user;
}

function sanitizePlayerForFirestore(p: Player): Record<string, unknown> {
  return {
    id: sanitizeId(p.id),
    name: sanitizeName(p.name),
    color: p.color,
    type: p.type,
    tokens: p.tokens.map(t => ({
      id: t.id,
      color: t.color,
      step: t.step,
      isHome: Boolean(t.isHome),
      isYard: Boolean(t.isYard),
    })),
    isWinner: Boolean(p.isWinner),
    hasLeft: Boolean(p.hasLeft),
    rank: typeof p.rank === 'number' ? p.rank : null,
  };
}

function sanitizeLastMove(move: MoveAnimationData | null | undefined): MoveAnimationData | null {
  if (!move) return null;
  return {
    moveId: move.moveId,
    playerId: sanitizeId(move.playerId),
    color: move.color,
    tokenId: move.tokenId,
    fromStep: move.fromStep,
    toStep: move.toStep,
    capturedTokens: (move.capturedTokens || []).map(c => ({
      playerId: sanitizeId(c.playerId),
      color: c.color,
      tokenId: c.tokenId,
      fromStep: c.fromStep,
    })),
    reachedHome: Boolean(move.reachedHome),
  };
}

function buildGameDocumentPayload(
  state: GameState,
  participantAuthUids: string[],
  options: { isCreate: boolean; createdAtValue?: unknown }
): Record<string, unknown> {
  return {
    gameId: sanitizeId(state.gameId, 'game'),
    mode: state.mode,
    playerCount: state.playerCount,
    players: state.players.map(sanitizePlayerForFirestore),
    participantAuthUids,
    currentTurnIndex: state.currentTurnIndex,
    diceValue: typeof state.diceValue === 'number' ? state.diceValue : null,
    isRolling: Boolean(state.isRolling),
    hasRolled: Boolean(state.hasRolled),
    validMoves: Array.isArray(state.validMoves) ? state.validMoves.slice(0, 4) : [],
    consecutiveSixes: state.consecutiveSixes || 0,
    status: state.status,
    winners: Array.isArray(state.winners) ? state.winners.slice(0, 4) : [],
    winner: state.winner ?? null,
    lastAction: (state.lastAction || '').slice(0, 290),
    history: (state.history || []).slice(0, 20).map(h => String(h).slice(0, 290)),
    roomCode: state.roomCode ?? null,
    turnTimeout: TURN_TIMEOUT_MS,
    turnId: state.turnId || generateTurnId(getEstimatedServerNow()),
    currentPlayerId: sanitizeId(
      state.currentPlayerId || state.players[state.currentTurnIndex]?.id || 'player'
    ),
    turnPhase: state.turnPhase || 'roll',
    turnStartedAt: state.turnStartedAt || getEstimatedServerNow(),
    diceDeadline: state.diceDeadline ?? null,
    tokenDeadline: state.tokenDeadline ?? null,
    isAutoMoving: Boolean(state.isAutoMoving),
    lastMove: sanitizeLastMove(state.lastMove),
    roomDisbanded: Boolean(state.roomDisbanded),
    disbandReason: state.disbandReason ? state.disbandReason.slice(0, 290) : null,
    createdAt: options.isCreate ? serverTimestamp() : options.createdAtValue,
    updatedAt: serverTimestamp(),
  };
}

function hydrateGameStateFromFirestore(
  data: Record<string, unknown>,
  fromPendingWrite: boolean
): GameState {
  if (!fromPendingWrite && data.updatedAt instanceof Timestamp) {
    updateServerClockOffsetFromMillis(data.updatedAt.toMillis());
  }

  const playersRaw = Array.isArray(data.players) ? (data.players as Player[]) : [];
  const players: Player[] = playersRaw.map(p => ({
    id: String(p.id),
    name: String(p.name),
    color: p.color,
    type: p.type,
    tokens: Array.isArray(p.tokens) ? p.tokens : [],
    isWinner: Boolean(p.isWinner),
    hasLeft: Boolean(p.hasLeft),
    rank: typeof p.rank === 'number' ? p.rank : undefined,
  }));

  return {
    gameId: String(data.gameId),
    mode: data.mode as GameState['mode'],
    playerCount: data.playerCount as 2 | 3 | 4,
    players,
    participantAuthUids: Array.isArray(data.participantAuthUids)
      ? (data.participantAuthUids as string[])
      : [],
    currentTurnIndex: Number(data.currentTurnIndex ?? 0),
    diceValue: typeof data.diceValue === 'number' ? data.diceValue : null,
    isRolling: Boolean(data.isRolling),
    hasRolled: Boolean(data.hasRolled),
    validMoves: Array.isArray(data.validMoves) ? (data.validMoves as number[]) : [],
    consecutiveSixes: Number(data.consecutiveSixes ?? 0),
    status: (data.status as GameState['status']) || 'playing',
    winners: Array.isArray(data.winners) ? (data.winners as PlayerColor[]) : [],
    winner: (data.winner as PlayerColor | null) ?? null,
    lastAction: String(data.lastAction ?? ''),
    history: Array.isArray(data.history) ? (data.history as string[]) : [],
    roomCode: typeof data.roomCode === 'string' ? data.roomCode : undefined,
    turnTimeout: typeof data.turnTimeout === 'number' ? data.turnTimeout : TURN_TIMEOUT_MS,
    turnId: typeof data.turnId === 'string' ? data.turnId : undefined,
    currentPlayerId:
      typeof data.currentPlayerId === 'string' ? data.currentPlayerId : undefined,
    turnPhase:
      data.turnPhase === 'roll' || data.turnPhase === 'move'
        ? data.turnPhase
        : undefined,
    turnStartedAt:
      typeof data.turnStartedAt === 'number' ? data.turnStartedAt : undefined,
    diceDeadline:
      typeof data.diceDeadline === 'number' ? data.diceDeadline : null,
    tokenDeadline:
      typeof data.tokenDeadline === 'number' ? data.tokenDeadline : null,
    serverNow: getEstimatedServerNow(),
    roomDisbanded: Boolean(data.roomDisbanded),
    disbandReason:
      typeof data.disbandReason === 'string' ? data.disbandReason : null,
    isAutoMoving: Boolean(data.isAutoMoving),
    lastMove: (data.lastMove as MoveAnimationData | null) ?? null,
  };
}

function hydrateRoomFromFirestore(data: Record<string, unknown>): RoomState {
  const createdAtMs =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : typeof data.createdAt === 'number'
      ? data.createdAt
      : Date.now();

  return {
    roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
    code: String(data.code),
    hostId: String(data.hostId),
    hostAuthUid: typeof data.hostAuthUid === 'string' ? data.hostAuthUid : undefined,
    maxPlayers: Number(data.maxPlayers) as 2 | 3 | 4,
    currentPlayerCount:
      typeof data.currentPlayerCount === 'number'
        ? data.currentPlayerCount
        : Array.isArray(data.players)
        ? data.players.length
        : 0,
    players: Array.isArray(data.players) ? (data.players as RoomParticipant[]) : [],
    assignedColors: Array.isArray(data.assignedColors)
      ? (data.assignedColors as PlayerColor[])
      : [],
    participantAuthUids: Array.isArray(data.participantAuthUids)
      ? (data.participantAuthUids as string[])
      : [],
    status: (data.status as RoomState['status']) || 'waiting',
    gameId: typeof data.gameId === 'string' ? data.gameId : null,
    createdAt: createdAtMs,
  };
}

function findNextActiveTurnIndex(players: Player[], fromIndex: number): number {
  for (let i = 1; i <= players.length; i++) {
    const candidateIdx = (fromIndex + i) % players.length;
    if (!players[candidateIdx].isWinner && !players[candidateIdx].hasLeft) {
      return candidateIdx;
    }
  }
  return fromIndex;
}

function applyRollPhaseToState(state: GameState): GameState {
  if (state.status !== 'playing') return state;

  let turnIdx = state.currentTurnIndex;
  if (
    !state.players[turnIdx] ||
    state.players[turnIdx].hasLeft ||
    state.players[turnIdx].isWinner
  ) {
    turnIdx = findNextActiveTurnIndex(state.players, turnIdx);
  }

  const now = getEstimatedServerNow();
  const currentPlayer = state.players[turnIdx];
  return {
    ...state,
    currentTurnIndex: turnIdx,
    currentPlayerId: currentPlayer.id,
    turnId: generateTurnId(now),
    turnPhase: 'roll',
    turnStartedAt: now,
    diceDeadline: now + TURN_TIMEOUT_MS,
    tokenDeadline: null,
    hasRolled: false,
    validMoves: [],
    isAutoMoving: false,
  };
}

function applyServerDiceRollToState(state: GameState, isAuto: boolean): GameState {
  const currentPlayer = state.players[state.currentTurnIndex];
  const roll = Math.floor(Math.random() * 6) + 1;
  const validMoves = getValidMoves(currentPlayer, roll);

  let nextConsecutiveSixes = roll === 6 ? state.consecutiveSixes + 1 : 0;
  let nextTurnIndex = state.currentTurnIndex;
  const prefix = isAuto ? '⏱️ Auto-roll: ' : '';
  let actionText = `${prefix}${currentPlayer.name} rolled a ${roll}.`;

  if (nextConsecutiveSixes >= 3) {
    actionText = `⚠️ ${prefix}${currentPlayer.name} rolled three 6s in a row! Turn forfeited.`;
    nextConsecutiveSixes = 0;
    nextTurnIndex = findNextActiveTurnIndex(state.players, state.currentTurnIndex);
  } else if (validMoves.length === 0) {
    actionText = `${prefix}${currentPlayer.name} rolled a ${roll} with no valid moves available.`;
    nextTurnIndex = findNextActiveTurnIndex(state.players, state.currentTurnIndex);
  }

  const shouldPassTurn = validMoves.length === 0 || nextConsecutiveSixes >= 3;

  // Automatic single-token movement rule (online modes):
  // Exactly 1 active token outside yard + dice 1..5 -> auto-move after short beat
  const activeTokensOutsideYard = currentPlayer.tokens.filter(
    t => t.step >= 0 && t.step < 56
  );
  const shouldAutoMoveSingleToken =
    !shouldPassTurn &&
    roll >= 1 &&
    roll <= 5 &&
    activeTokensOutsideYard.length === 1 &&
    validMoves.length === 1;

  const now = getEstimatedServerNow();
  const activeTurnId = state.turnId || generateTurnId(now);

  const rolledState: GameState = {
    ...state,
    diceValue: roll,
    hasRolled: !shouldPassTurn,
    validMoves: shouldPassTurn ? [] : validMoves,
    currentTurnIndex: shouldPassTurn ? nextTurnIndex : state.currentTurnIndex,
    consecutiveSixes: nextConsecutiveSixes,
    isAutoMoving: shouldAutoMoveSingleToken,
    lastAction: actionText,
    history: [actionText, ...state.history.slice(0, 19)],
  };

  if (shouldPassTurn) {
    return applyRollPhaseToState(rolledState);
  }

  if (shouldAutoMoveSingleToken) {
    return {
      ...rolledState,
      currentPlayerId: currentPlayer.id,
      turnId: activeTurnId,
      turnPhase: 'move',
      turnStartedAt: now,
      diceDeadline: null,
      tokenDeadline: null,
      isAutoMoving: true,
    };
  }

  return {
    ...rolledState,
    currentPlayerId: currentPlayer.id,
    turnId: activeTurnId,
    turnPhase: 'move',
    turnStartedAt: now,
    diceDeadline: null,
    tokenDeadline: now + TURN_TIMEOUT_MS,
    isAutoMoving: false,
  };
}

function applyTokenMoveToState(
  state: GameState,
  tokenIndex: number,
  isAuto: boolean
): GameState {
  const { updatedState } = executeMove(state, tokenIndex);

  if (isAuto) {
    const autoMsg = `⏱️ Auto-move: ${updatedState.lastAction}`;
    updatedState.lastAction = autoMsg;
    updatedState.history = [autoMsg, ...updatedState.history.slice(1, 20)];
  }

  const nextState: GameState = {
    ...updatedState,
    isAutoMoving: false,
  };

  if (nextState.status === 'playing') {
    return applyRollPhaseToState(nextState);
  }

  return {
    ...nextState,
    turnPhase: undefined,
    diceDeadline: null,
    tokenDeadline: null,
    isAutoMoving: false,
  };
}

// ============================================================================
// 1. QUICK MATCH FIREBASE BACKEND MATCHMAKING (ATOMIC TRANSACTIONS)
// ============================================================================

export async function enterMatchmakingQueue(
  rawPlayerId: string,
  rawPlayerName: string,
  targetCount: 2 | 4
): Promise<{ status: 'searching' | 'matched'; gameId?: string; playersFound: number }> {
  const user = requireVerifiedAuthUser();
  const playerId = sanitizeId(rawPlayerId, 'qm');
  const playerName = sanitizeName(rawPlayerName, 'Player');
  const queueRef = doc(db, 'mudo_queues', playerId);

  try {
    // Ensure a clean queue doc creation so createdAt == request.time succeeds
    const existing = await getDoc(queueRef);
    if (existing.exists()) {
      await deleteDoc(queueRef).catch(() => {});
    }

    const now = getEstimatedServerNow();
    await setDoc(queueRef, {
      playerId,
      authUid: user.uid,
      playerName,
      targetCount,
      status: 'waiting',
      gameId: null,
      expiresAt: now + QUEUE_TTL_MS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const matchAttempt = await attemptMatchmakingTransaction(playerId, targetCount);
    return matchAttempt;
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `mudo_queues/${playerId}`);
    }
    reportServerError('matchmaking_join', err, { targetCount });
    throw err;
  }
}

export async function attemptMatchmakingTransaction(
  myPlayerId: string,
  targetCount: 2 | 4
): Promise<{ status: 'searching' | 'matched'; gameId?: string; playersFound: number }> {
  const user = requireVerifiedAuthUser();
  const cleanMyId = sanitizeId(myPlayerId, 'qm');

  try {
    const q = query(
      collection(db, 'mudo_queues'),
      where('targetCount', '==', targetCount),
      where('status', '==', 'waiting'),
      limit(16)
    );
    const snap = await getDocs(q);
    const now = getEstimatedServerNow();

    interface Candidate {
      playerId: string;
      authUid: string;
      playerName: string;
      createdAtMs: number;
      expiresAt: number;
    }

    const candidates: Candidate[] = [];
    const seenIds = new Set<string>();

    snap.docs.forEach(d => {
      const data = d.data();
      const pid = String(data.playerId || d.id);
      const expiresAt = Number(data.expiresAt || 0);
      if (expiresAt > 0 && expiresAt < now) {
        // Prune stale expired queue entries asynchronously
        void deleteDoc(d.ref).catch(() => {});
        return;
      }
      if (!seenIds.has(pid) && data.status === 'waiting') {
        seenIds.add(pid);
        const createdAtMs =
          data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : now;
        candidates.push({
          playerId: pid,
          authUid: String(data.authUid || ''),
          playerName: sanitizeName(String(data.playerName || 'Player')),
          createdAtMs,
          expiresAt,
        });
      }
    });

    candidates.sort((a, b) => a.createdAtMs - b.createdAtMs);

    if (candidates.length < targetCount) {
      return { status: 'searching', playersFound: candidates.length };
    }

    // Ensure current player participates in the candidate slice if they just joined
    let selected = candidates.slice(0, targetCount);
    const meInSelected = selected.some(c => c.playerId === cleanMyId);
    const meInCandidates = candidates.find(c => c.playerId === cleanMyId);
    if (!meInSelected && meInCandidates) {
      selected = [...candidates.slice(0, targetCount - 1), meInCandidates];
    }

    const gameId = await runTransaction(db, async tx => {
      const queueRefs = selected.map(c => doc(db, 'mudo_queues', c.playerId));
      const docs = await Promise.all(queueRefs.map(ref => tx.get(ref)));

      const verified: Candidate[] = [];
      const uniqueIds = new Set<string>();

      for (let i = 0; i < docs.length; i++) {
        const docSnap = docs[i];
        if (!docSnap.exists()) {
          throw new Error('QUEUE_ENTRY_MISSING');
        }
        const dData = docSnap.data();
        const pid = String(dData.playerId);
        if (
          dData.status !== 'waiting' ||
          Number(dData.targetCount) !== targetCount ||
          Number(dData.expiresAt || 0) < now ||
          uniqueIds.has(pid)
        ) {
          throw new Error('QUEUE_CONTENTION_RETRY');
        }
        uniqueIds.add(pid);
        verified.push({
          playerId: pid,
          authUid: String(dData.authUid),
          playerName: sanitizeName(String(dData.playerName || 'Player')),
          createdAtMs: now,
          expiresAt: Number(dData.expiresAt),
        });
      }

      if (verified.length !== targetCount) {
        throw new Error('QUEUE_COUNT_MISMATCH');
      }

      const newGameId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const allowedColors: PlayerColor[] =
        targetCount === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

      const assignedPlayers: Player[] = allowedColors.map((color, idx) => {
        const qp = verified[idx];
        return {
          id: qp.playerId,
          name: qp.playerName,
          color,
          type: 'remote',
          tokens: [0, 1, 2, 3].map(id => createToken(id, color)),
          isWinner: false,
          hasLeft: false,
        };
      });

      const participantAuthUids = Array.from(
        new Set([...verified.map(v => v.authUid), user.uid])
      ).slice(0, 4);

      const initialGame = createInitialGameState('quick_match', targetCount, {
        gameId: newGameId,
        playerNames: assignedPlayers.map(p => p.name),
      });
      initialGame.players = assignedPlayers;
      initialGame.lastAction = `Match started! ${assignedPlayers[0].name}'s turn to roll.`;
      initialGame.history = [
        `Match started in QUICK_MATCH mode with ${targetCount} players.`,
      ];

      const readyGame = applyRollPhaseToState(initialGame);
      const gamePayload = buildGameDocumentPayload(readyGame, participantAuthUids, {
        isCreate: true,
      });

      tx.set(doc(db, 'mudo_games', newGameId), gamePayload);

      verified.forEach(v => {
        tx.update(doc(db, 'mudo_queues', v.playerId), {
          status: 'matched',
          gameId: newGameId,
          updatedAt: serverTimestamp(),
        });
      });

      return newGameId;
    });

    return { status: 'matched', gameId, playersFound: targetCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (
      msg === 'QUEUE_ENTRY_MISSING' ||
      msg === 'QUEUE_CONTENTION_RETRY' ||
      msg === 'QUEUE_COUNT_MISMATCH'
    ) {
      // Another device likely matched concurrently — check our own queue entry
      const selfSnap = await getDoc(doc(db, 'mudo_queues', cleanMyId)).catch(() => null);
      if (selfSnap?.exists() && selfSnap.data().status === 'matched' && selfSnap.data().gameId) {
        return {
          status: 'matched',
          gameId: String(selfSnap.data().gameId),
          playersFound: targetCount,
        };
      }
      return { status: 'searching', playersFound: 1 };
    }
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, 'mudo_queues');
    }
    reportServerError('matchmaking_transaction', err, { targetCount });
    return { status: 'searching', playersFound: 1 };
  }
}

export function subscribeMatchmaking(
  rawPlayerId: string,
  targetCount: 2 | 4,
  callbacks: {
    onPlayersCount: (count: number) => void;
    onMatched: (gameId: string) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const playerId = sanitizeId(rawPlayerId, 'qm');
  let finished = false;

  const unsubSelf = onSnapshot(
    doc(db, 'mudo_queues', playerId),
    snap => {
      if (finished || !snap.exists()) return;
      const data = snap.data();
      if (data.status === 'matched' && typeof data.gameId === 'string') {
        finished = true;
        callbacks.onMatched(data.gameId);
      }
    },
    err => {
      reportServerError('matchmaking_self_listener', err);
      callbacks.onError(err);
    }
  );

  const q = query(
    collection(db, 'mudo_queues'),
    where('targetCount', '==', targetCount),
    where('status', '==', 'waiting'),
    limit(16)
  );

  const unsubQueue = onSnapshot(
    q,
    snap => {
      if (finished) return;
      const now = getEstimatedServerNow();
      const activeIds = new Set<string>();
      snap.docs.forEach(d => {
        const data = d.data();
        const expiresAt = Number(data.expiresAt || 0);
        if (expiresAt === 0 || expiresAt >= now) {
          activeIds.add(String(data.playerId || d.id));
        }
      });

      const count = Math.max(1, activeIds.size);
      callbacks.onPlayersCount(count);

      if (activeIds.size >= targetCount) {
        void attemptMatchmakingTransaction(playerId, targetCount).then(result => {
          if (!finished && result.status === 'matched' && result.gameId) {
            finished = true;
            callbacks.onMatched(result.gameId);
          }
        });
      }
    },
    err => {
      reportServerError('matchmaking_queue_listener', err, { targetCount });
      callbacks.onError(err);
    }
  );

  return () => {
    finished = true;
    unsubSelf();
    unsubQueue();
  };
}

export async function refreshMatchmakingHeartbeat(
  rawPlayerId: string,
  rawPlayerName: string
): Promise<void> {
  const playerId = sanitizeId(rawPlayerId, 'qm');
  const queueRef = doc(db, 'mudo_queues', playerId);
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(queueRef);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== 'waiting') return;
      tx.update(queueRef, {
        expiresAt: getEstimatedServerNow() + QUEUE_TTL_MS,
        playerName: sanitizeName(rawPlayerName, 'Player'),
        updatedAt: serverTimestamp(),
      });
    });
  } catch {
    // Non-fatal heartbeat failure
  }
}

export async function leaveMatchmakingQueue(rawPlayerId: string): Promise<void> {
  const playerId = sanitizeId(rawPlayerId, 'qm');
  const queueRef = doc(db, 'mudo_queues', playerId);
  try {
    const snap = await getDoc(queueRef);
    if (snap.exists() && snap.data().status === 'waiting') {
      await deleteDoc(queueRef);
    }
  } catch {
    // Ignore cleanup errors on unmount
  }
}

// ============================================================================
// 2. FRIENDLY MODE: ATOMIC ROOM CREATE, JOIN, VALIDATION & LOBBY SYNC
// ============================================================================

export async function createFriendlyRoom(params: {
  hostName: string;
  maxPlayers: 2 | 3 | 4;
  playerId: string;
}): Promise<{ room: RoomState; playerId: string }> {
  const user = requireVerifiedAuthUser();
  const hostId = sanitizeId(params.playerId, 'host');
  const hostName = sanitizeName(params.hostName, 'Host');
  const maxPlayers = params.maxPlayers;
  const roomId = `rm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateRoomCode();
    const roomRef = doc(db, 'mudo_rooms', code);

    try {
      const createdRoom = await runTransaction(db, async tx => {
        const existingSnap = await tx.get(roomRef);
        if (existingSnap.exists()) {
          throw new Error('ROOM_CODE_COLLISION');
        }

        const now = getEstimatedServerNow();
        const hostParticipant: RoomParticipant = {
          id: hostId,
          authUid: user.uid,
          name: hostName,
          color: 'red',
          isHost: true,
          isReady: true,
          connectedAt: now,
        };

        const roomDocPayload = {
          roomId,
          code,
          hostId,
          hostAuthUid: user.uid,
          maxPlayers,
          currentPlayerCount: 1,
          players: [hostParticipant],
          assignedColors: ['red'] as PlayerColor[],
          participantAuthUids: [user.uid],
          status: 'waiting' as const,
          gameId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        tx.set(roomRef, roomDocPayload);

        return {
          roomId,
          code,
          hostId,
          hostAuthUid: user.uid,
          maxPlayers,
          currentPlayerCount: 1,
          players: [hostParticipant],
          assignedColors: ['red'] as PlayerColor[],
          participantAuthUids: [user.uid],
          status: 'waiting' as const,
          gameId: null,
          createdAt: now,
        };
      });

      return { room: createdRoom, playerId: hostId };
    } catch (err) {
      if (err instanceof Error && err.message === 'ROOM_CODE_COLLISION') {
        continue;
      }
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.CREATE, `mudo_rooms/${code}`);
      }
      reportServerError('create_friendly_room', err, { maxPlayers });
      if (isNetworkOrUnavailableError(err)) {
        throw new Error(ROOM_JOIN_MESSAGES.CONNECTION_ERROR);
      }
      throw new Error('Failed to create room. Please try again.');
    }
  }

  reportServerError('create_friendly_room_collision_exhausted', new Error('Collision retry limit'));
  throw new Error('Failed to create room. Please try again.');
}

export async function joinFriendlyRoom(params: {
  roomCode: string;
  playerName: string;
  playerId: string;
}): Promise<{ room: RoomState; playerId: string; gameId?: string | null }> {
  const user = requireVerifiedAuthUser();
  const code = normalizeAndValidateRoomCode(params.roomCode);
  const cleanPlayerId = sanitizeId(params.playerId, 'usr');
  const cleanName = sanitizeName(params.playerName, 'Player');
  const roomRef = doc(db, 'mudo_rooms', code);

  try {
    const result = await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) {
        throw new RoomJoinError('NOT_FOUND', ROOM_JOIN_MESSAGES.NOT_FOUND);
      }

      const raw = snap.data();
      const room = hydrateRoomFromFirestore(raw);

      if (room.status === 'disbanded') {
        throw new RoomJoinError('ROOM_CLOSED', ROOM_JOIN_MESSAGES.ROOM_CLOSED);
      }

      const alreadyInRoom = room.players.some(p => p.id === cleanPlayerId);
      if (alreadyInRoom) {
        throw new RoomJoinError('ALREADY_JOINED', ROOM_JOIN_MESSAGES.ALREADY_JOINED);
      }

      if (room.status === 'in_game' || Boolean(room.gameId)) {
        throw new RoomJoinError(
          'ALREADY_STARTED',
          ROOM_JOIN_MESSAGES.ALREADY_STARTED
        );
      }

      if (room.players.length >= room.maxPlayers) {
        throw new RoomJoinError('ROOM_FULL', ROOM_JOIN_MESSAGES.ROOM_FULL);
      }

      const availableColors: PlayerColor[] =
        room.maxPlayers === 2
          ? ['red', 'yellow']
          : room.maxPlayers === 3
          ? ['red', 'green', 'yellow']
          : ['red', 'green', 'yellow', 'blue'];

      const usedColors = new Set(room.players.map(p => p.color));
      const assignedColor =
        availableColors.find(c => !usedColors.has(c)) || 'blue';

      const now = getEstimatedServerNow();
      const newParticipant: RoomParticipant = {
        id: cleanPlayerId,
        authUid: user.uid,
        name: cleanName,
        color: assignedColor,
        isHost: false,
        isReady: true,
        connectedAt: now,
      };

      const nextPlayers = [...room.players, newParticipant];
      const nextAssignedColors = nextPlayers.map(p => p.color);
      const nextAuthUids = Array.from(
        new Set([...(room.participantAuthUids || []), user.uid])
      ).slice(0, 4);

      if (nextPlayers.length === room.maxPlayers) {
        const gameId = `roomgame_${code}_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 6)}`;

        const initialGame = createInitialGameState('friendly', room.maxPlayers, {
          gameId,
          roomCode: code,
          playerNames: nextPlayers.map(p => p.name),
        });

        initialGame.players = nextPlayers.map(rp => ({
          id: rp.id,
          name: rp.name,
          color: rp.color,
          type: 'remote',
          tokens: [0, 1, 2, 3].map(id => createToken(id, rp.color)),
          isWinner: false,
          hasLeft: false,
        }));

        const readyGame = applyRollPhaseToState(initialGame);
        const gamePayload = buildGameDocumentPayload(readyGame, nextAuthUids, {
          isCreate: true,
        });

        tx.set(doc(db, 'mudo_games', gameId), gamePayload);
        tx.update(roomRef, {
          players: nextPlayers,
          currentPlayerCount: nextPlayers.length,
          assignedColors: nextAssignedColors,
          participantAuthUids: nextAuthUids,
          status: 'in_game',
          gameId,
          updatedAt: serverTimestamp(),
        });

        return {
          room: {
            ...room,
            players: nextPlayers,
            currentPlayerCount: nextPlayers.length,
            assignedColors: nextAssignedColors,
            participantAuthUids: nextAuthUids,
            status: 'in_game' as const,
            gameId,
          },
          playerId: cleanPlayerId,
          gameId,
        };
      }

      tx.update(roomRef, {
        players: nextPlayers,
        currentPlayerCount: nextPlayers.length,
        assignedColors: nextAssignedColors,
        participantAuthUids: nextAuthUids,
        updatedAt: serverTimestamp(),
      });

      return {
        room: {
          ...room,
          players: nextPlayers,
          currentPlayerCount: nextPlayers.length,
          assignedColors: nextAssignedColors,
          participantAuthUids: nextAuthUids,
        },
        playerId: cleanPlayerId,
        gameId: null,
      };
    });

    return result;
  } catch (err) {
    if (err instanceof RoomJoinError) {
      throw err;
    }
    if (isNetworkOrUnavailableError(err)) {
      reportServerError('join_friendly_room_network', err, { code });
      throw new RoomJoinError('CONNECTION_ERROR', ROOM_JOIN_MESSAGES.CONNECTION_ERROR);
    }
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.UPDATE, `mudo_rooms/${code}`);
    }
    reportServerError('join_friendly_room_unknown', err, { code });
    throw new RoomJoinError('CONNECTION_ERROR', ROOM_JOIN_MESSAGES.CONNECTION_ERROR);
  }
}

export function subscribeToRoom(
  roomCode: string,
  callbacks: {
    onRoom: (room: RoomState) => void;
    onDisbanded: () => void;
    onError: (err: Error) => void;
  }
): () => void {
  const code = roomCode.trim().toUpperCase();
  return onSnapshot(
    doc(db, 'mudo_rooms', code),
    snap => {
      if (!snap.exists()) {
        callbacks.onDisbanded();
        return;
      }
      const room = hydrateRoomFromFirestore(snap.data());
      if (room.status === 'disbanded') {
        callbacks.onDisbanded();
        return;
      }
      callbacks.onRoom(room);
    },
    err => {
      reportServerError('room_listener', err, { code });
      callbacks.onError(err);
    }
  );
}

export async function leaveFriendlyRoom(
  roomCode: string,
  rawPlayerId: string
): Promise<void> {
  const code = roomCode.trim().toUpperCase();
  const playerId = sanitizeId(rawPlayerId, 'usr');
  const roomRef = doc(db, 'mudo_rooms', code);

  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;
      const room = hydrateRoomFromFirestore(snap.data());
      if (room.status !== 'waiting') return;

      const remainingPlayers = room.players.filter(p => p.id !== playerId);
      if (remainingPlayers.length === 0) {
        tx.update(roomRef, {
          players: [],
          currentPlayerCount: 0,
          assignedColors: [],
          participantAuthUids: [],
          status: 'disbanded',
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const nextHost =
        room.hostId === playerId ? remainingPlayers[0] : remainingPlayers.find(p => p.id === room.hostId) || remainingPlayers[0];

      const normalizedPlayers = remainingPlayers.map(p => ({
        ...p,
        isHost: p.id === nextHost.id,
      }));
      const nextAuthUids = Array.from(
        new Set(
          normalizedPlayers
            .map(p => p.authUid)
            .filter((u): u is string => Boolean(u))
        )
      );

      tx.update(roomRef, {
        players: normalizedPlayers,
        currentPlayerCount: normalizedPlayers.length,
        assignedColors: normalizedPlayers.map(p => p.color),
        participantAuthUids: nextAuthUids,
        hostId: nextHost.id,
        hostAuthUid: nextHost.authUid || room.hostAuthUid,
        status: 'waiting',
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    reportServerError('leave_friendly_room', err, { code });
  }
}

// ============================================================================
// 3. ONLINE GAME STATE SYNCHRONIZATION, ROLLS, MOVES, TIMERS & PRESENCE
// ============================================================================

export async function fetchGameState(gameId: string): Promise<GameState | null> {
  const cleanGameId = sanitizeId(gameId, 'game');
  try {
    const snap = await getDoc(doc(db, 'mudo_games', cleanGameId));
    if (!snap.exists()) return null;
    return hydrateGameStateFromFirestore(snap.data(), false);
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.GET, `mudo_games/${cleanGameId}`);
    }
    reportServerError('fetch_game_state', err, { gameId: cleanGameId });
    return null;
  }
}

export function subscribeToGame(
  gameId: string,
  callbacks: {
    onState: (state: GameState) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const cleanGameId = sanitizeId(gameId, 'game');
  return onSnapshot(
    doc(db, 'mudo_games', cleanGameId),
    snap => {
      if (!snap.exists()) return;
      const hydrated = hydrateGameStateFromFirestore(
        snap.data(),
        snap.metadata.hasPendingWrites
      );
      callbacks.onState(hydrated);
    },
    err => {
      reportServerError('game_listener', err, { gameId: cleanGameId });
      callbacks.onError(err);
    }
  );
}

export async function rollOnlineDice(
  gameId: string,
  rawPlayerId: string
): Promise<GameState | null> {
  const cleanGameId = sanitizeId(gameId, 'game');
  const playerId = sanitizeId(rawPlayerId, 'usr');
  const gameRef = doc(db, 'mudo_games', cleanGameId);

  try {
    return await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) return null;

      const raw = snap.data();
      const state = hydrateGameStateFromFirestore(raw, false);
      if (state.status !== 'playing') return state;

      const currentPlayer = state.players[state.currentTurnIndex];
      if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.hasLeft) {
        return null;
      }
      if (state.hasRolled || state.turnPhase !== 'roll') {
        return null;
      }

      const nextState = applyServerDiceRollToState(state, false);
      const authUids = Array.isArray(raw.participantAuthUids)
        ? (raw.participantAuthUids as string[])
        : [];
      const payload = buildGameDocumentPayload(nextState, authUids, {
        isCreate: false,
        createdAtValue: raw.createdAt,
      });

      tx.update(gameRef, payload);
      return nextState;
    });
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.UPDATE, `mudo_games/${cleanGameId}`);
    }
    reportServerError('roll_online_dice', err, { gameId: cleanGameId });
    return null;
  }
}

export async function moveOnlineToken(
  gameId: string,
  rawPlayerId: string,
  tokenIndex: number
): Promise<GameState | null> {
  const cleanGameId = sanitizeId(gameId, 'game');
  const playerId = sanitizeId(rawPlayerId, 'usr');
  const gameRef = doc(db, 'mudo_games', cleanGameId);

  try {
    return await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) return null;

      const raw = snap.data();
      const state = hydrateGameStateFromFirestore(raw, false);
      if (state.status !== 'playing') return state;

      const currentPlayer = state.players[state.currentTurnIndex];
      if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.hasLeft) {
        return null;
      }
      if (
        !state.hasRolled ||
        state.turnPhase !== 'move' ||
        state.diceValue === null ||
        state.isAutoMoving ||
        !state.validMoves.includes(tokenIndex)
      ) {
        return null;
      }

      const nextState = applyTokenMoveToState(state, tokenIndex, false);
      const authUids = Array.isArray(raw.participantAuthUids)
        ? (raw.participantAuthUids as string[])
        : [];
      const payload = buildGameDocumentPayload(nextState, authUids, {
        isCreate: false,
        createdAtValue: raw.createdAt,
      });

      tx.update(gameRef, payload);
      return nextState;
    });
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.UPDATE, `mudo_games/${cleanGameId}`);
    }
    reportServerError('move_online_token', err, { gameId: cleanGameId });
    return null;
  }
}

export async function executeOnlineAutoSingleMove(
  gameId: string,
  expectedTurnId: string,
  tokenIndex: number
): Promise<GameState | null> {
  const cleanGameId = sanitizeId(gameId, 'game');
  const gameRef = doc(db, 'mudo_games', cleanGameId);

  try {
    return await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) return null;

      const raw = snap.data();
      const state = hydrateGameStateFromFirestore(raw, false);
      if (
        state.status !== 'playing' ||
        state.turnId !== expectedTurnId ||
        state.turnPhase !== 'move' ||
        !state.isAutoMoving ||
        !state.hasRolled ||
        state.diceValue === null
      ) {
        return null;
      }

      const nextState = applyTokenMoveToState(state, tokenIndex, false);
      const authUids = Array.isArray(raw.participantAuthUids)
        ? (raw.participantAuthUids as string[])
        : [];
      const payload = buildGameDocumentPayload(nextState, authUids, {
        isCreate: false,
        createdAtValue: raw.createdAt,
      });

      tx.update(gameRef, payload);
      return nextState;
    });
  } catch (err) {
    reportServerError('auto_single_move', err, { gameId: cleanGameId });
    return null;
  }
}

export async function claimOnlineTurnTimeout(
  gameId: string,
  expectedTurnId: string,
  expectedPhase: 'roll' | 'move'
): Promise<void> {
  const cleanGameId = sanitizeId(gameId, 'game');
  const gameRef = doc(db, 'mudo_games', cleanGameId);

  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) return;

      const raw = snap.data();
      const state = hydrateGameStateFromFirestore(raw, false);
      if (
        state.status !== 'playing' ||
        state.turnId !== expectedTurnId ||
        state.turnPhase !== expectedPhase
      ) {
        return;
      }

      const now = getEstimatedServerNow();
      const deadline =
        expectedPhase === 'roll' ? state.diceDeadline : state.tokenDeadline;
      if (!deadline || now < deadline) {
        return;
      }

      let nextState: GameState;
      if (expectedPhase === 'roll') {
        if (state.hasRolled) return;
        nextState = applyServerDiceRollToState(state, true);
      } else {
        if (state.isAutoMoving || !state.hasRolled || state.diceValue === null) {
          return;
        }
        if (!state.validMoves || state.validMoves.length === 0) {
          const nextIdx = findNextActiveTurnIndex(
            state.players,
            state.currentTurnIndex
          );
          nextState = applyRollPhaseToState({
            ...state,
            currentTurnIndex: nextIdx,
            hasRolled: false,
            validMoves: [],
            diceValue: null,
          });
        } else {
          const chosen =
            state.validMoves.length === 1
              ? state.validMoves[0]
              : state.validMoves[
                  Math.floor(Math.random() * state.validMoves.length)
                ];
          nextState = applyTokenMoveToState(state, chosen, true);
        }
      }

      const authUids = Array.isArray(raw.participantAuthUids)
        ? (raw.participantAuthUids as string[])
        : [];
      const payload = buildGameDocumentPayload(nextState, authUids, {
        isCreate: false,
        createdAtValue: raw.createdAt,
      });

      tx.update(gameRef, payload);
    });
  } catch (err) {
    reportServerError('claim_turn_timeout', err, {
      gameId: cleanGameId,
      expectedPhase,
    });
  }
}

export async function sendGamePresenceHeartbeat(
  gameId: string,
  rawPlayerId: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const cleanGameId = sanitizeId(gameId, 'game');
  const playerId = sanitizeId(rawPlayerId, 'usr');

  try {
    await setDoc(doc(db, 'mudo_games', cleanGameId, 'presence', playerId), {
      playerId,
      authUid: user.uid,
      lastSeen: serverTimestamp(),
    });
  } catch {
    // Non-fatal heartbeat write
  }
}

export async function checkOnlinePeerDisconnects(
  gameId: string,
  localPlayerId: string,
  players: Player[],
  gameCreatedAtMs?: number
): Promise<void> {
  const cleanGameId = sanitizeId(gameId, 'game');
  const cleanLocalId = sanitizeId(localPlayerId, 'usr');
  const now = getEstimatedServerNow();

  // Give newly joined devices 15s to emit their first heartbeat
  if (gameCreatedAtMs && now - gameCreatedAtMs < 15_000) {
    return;
  }

  for (const p of players) {
    if (p.id === cleanLocalId || p.hasLeft || p.isWinner) continue;
    try {
      const presSnap = await getDoc(
        doc(db, 'mudo_games', cleanGameId, 'presence', sanitizeId(p.id, 'usr'))
      );
      if (presSnap.exists()) {
        const lastSeen = presSnap.data().lastSeen;
        if (lastSeen instanceof Timestamp) {
          const ageMs = now - lastSeen.toMillis();
          if (ageMs > PRESENCE_DISCONNECT_GRACE_MS) {
            await removeOnlinePlayer(cleanGameId, p.id, 'disconnected');
            return;
          }
        }
      }
    } catch {
      // Ignore transient read failures
    }
  }
}

export async function removeOnlinePlayer(
  gameId: string,
  rawLeavingPlayerId: string,
  reason: 'left' | 'disconnected'
): Promise<void> {
  const cleanGameId = sanitizeId(gameId, 'game');
  const leavingPlayerId = sanitizeId(rawLeavingPlayerId, 'usr');
  const gameRef = doc(db, 'mudo_games', cleanGameId);

  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      if (!snap.exists()) return;

      const raw = snap.data();
      const state = hydrateGameStateFromFirestore(raw, false);
      if (state.status !== 'playing') return;

      const leavingIdx = state.players.findIndex(p => p.id === leavingPlayerId);
      if (leavingIdx === -1) return;
      const leavingPlayer = state.players[leavingIdx];
      if (leavingPlayer.hasLeft) return;

      const updatedPlayers = state.players.map((p, idx) =>
        idx === leavingIdx ? { ...p, hasLeft: true } : p
      );
      const activeRemaining = updatedPlayers.filter(p => !p.hasLeft);

      const authUids = Array.isArray(raw.participantAuthUids)
        ? (raw.participantAuthUids as string[])
        : [];

      let roomSnapData: Record<string, unknown> | null = null;
      const roomRef = state.roomCode ? doc(db, 'mudo_rooms', state.roomCode) : null;
      if (roomRef) {
        const rSnap = await tx.get(roomRef);
        if (rSnap.exists()) {
          roomSnapData = rSnap.data();
        }
      }

      if (activeRemaining.length <= 1) {
        const disbandMsg =
          state.playerCount === 2
            ? `${leavingPlayer.name} (opponent) ${
                reason === 'disconnected' ? 'disconnected' : 'left the match'
              }. The room has been disbanded.`
            : 'All other players have left the match. The room has been closed.';

        const disbandedState: GameState = {
          ...state,
          players: updatedPlayers,
          status: 'disbanded',
          roomDisbanded: true,
          disbandReason: disbandMsg,
          hasRolled: false,
          validMoves: [],
          diceDeadline: null,
          tokenDeadline: null,
          isAutoMoving: false,
          lastAction: disbandMsg,
          history: [disbandMsg, ...state.history.slice(0, 19)],
        };

        const payload = buildGameDocumentPayload(disbandedState, authUids, {
          isCreate: false,
          createdAtValue: raw.createdAt,
        });
        tx.update(gameRef, payload);

        if (roomRef && roomSnapData && roomSnapData.status === 'in_game') {
          tx.update(roomRef, {
            status: 'disbanded',
            players: [],
            currentPlayerCount: 0,
            updatedAt: serverTimestamp(),
          });
        }
        return;
      }

      const leaveAction =
        reason === 'disconnected'
          ? `${leavingPlayer.name} disconnected and was removed from the match.`
          : `${leavingPlayer.name} left the match.`;

      const wasLeavingPlayersTurn = state.currentTurnIndex === leavingIdx;
      const nextTurnIdx = wasLeavingPlayersTurn
        ? findNextActiveTurnIndex(updatedPlayers, leavingIdx)
        : state.currentTurnIndex;

      let updatedState: GameState = {
        ...state,
        players: updatedPlayers,
        currentTurnIndex: nextTurnIdx,
        lastAction: leaveAction,
        history: [leaveAction, ...state.history.slice(0, 19)],
      };

      if (wasLeavingPlayersTurn) {
        updatedState = applyRollPhaseToState(updatedState);
      }

      const payload = buildGameDocumentPayload(updatedState, authUids, {
        isCreate: false,
        createdAtValue: raw.createdAt,
      });
      tx.update(gameRef, payload);
    });
  } catch (err) {
    reportServerError('remove_online_player', err, { gameId: cleanGameId, reason });
  }
}
