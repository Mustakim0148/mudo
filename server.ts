/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  createInitialGameState,
  createToken,
  executeMove,
  getValidMoves,
} from './src/utils/ludoEngine.ts';
import { GameState, Player, PlayerColor, RoomState } from './src/types/ludo.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json());

const TURN_TIMEOUT_MS = 15_000;
const DISCONNECT_CONFIRM_MS = 10_000;

// In-Memory authoritative state management for real-time multiplayer
interface ActiveGameRecord {
  state: GameState;
  clients: Map<string, Response>; // playerId -> SSE response
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  turnTimer?: ReturnType<typeof setTimeout>;
  autoMoveTimer?: ReturnType<typeof setTimeout>;
  isDisbanded: boolean;
  lastActivity: number;
}

const activeRooms = new Map<string, RoomState>();
const activeGames = new Map<string, ActiveGameRecord>();

// Matchmaking queues separated strictly by target player count
interface QueuePlayer {
  playerId: string;
  playerName: string;
  joinedAt: number;
}
const matchmakingQueue2P: QueuePlayer[] = [];
const matchmakingQueue4P: QueuePlayer[] = [];
const playerToGameMap = new Map<string, string>(); // playerId -> gameId

function stampState(state: GameState): GameState {
  return {
    ...state,
    serverNow: Date.now(),
  };
}

// Helper to broadcast authoritative state (with server timestamp) to all clients in a game
function broadcastGameState(gameId: string) {
  const record = activeGames.get(gameId);
  if (!record) return;

  const payload = stampState(record.state);
  const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
  record.clients.forEach((res, pId) => {
    try {
      res.write(dataStr);
    } catch {
      record.clients.delete(pId);
    }
  });
}

function clearTurnTimer(record: ActiveGameRecord) {
  if (record.turnTimer) {
    clearTimeout(record.turnTimer);
    record.turnTimer = undefined;
  }
  if (record.autoMoveTimer) {
    clearTimeout(record.autoMoveTimer);
    record.autoMoveTimer = undefined;
  }
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

function disbandGameAndRoom(
  gameId: string,
  reason: string
) {
  const record = activeGames.get(gameId);
  if (!record || record.isDisbanded) return;

  record.isDisbanded = true;
  clearTurnTimer(record);
  record.disconnectTimers.forEach(t => clearTimeout(t));
  record.disconnectTimers.clear();

  record.state = {
    ...record.state,
    status: 'disbanded',
    roomDisbanded: true,
    disbandReason: reason,
    hasRolled: false,
    validMoves: [],
    diceDeadline: null,
    tokenDeadline: null,
    lastAction: reason,
    history: [reason, ...record.state.history.slice(0, 19)],
  };
  record.lastActivity = Date.now();

  // Remove all player-to-game mappings
  record.state.players.forEach(p => {
    if (playerToGameMap.get(p.id) === gameId) {
      playerToGameMap.delete(p.id);
    }
  });

  // Clean up / disband Friendly Room if linked
  if (record.state.roomCode) {
    const rm = activeRooms.get(record.state.roomCode);
    if (rm) {
      rm.status = 'disbanded';
      activeRooms.delete(record.state.roomCode);
    }
  }

  broadcastGameState(gameId);

  // Purge disbanded game record after clients have received notification
  setTimeout(() => {
    const rec = activeGames.get(gameId);
    if (rec && rec.isDisbanded) {
      rec.clients.forEach(clientRes => {
        try {
          clientRes.end();
        } catch {}
      });
      rec.clients.clear();
      activeGames.delete(gameId);
    }
  }, 30_000);
}

function removePlayerFromActiveGame(
  gameId: string,
  leavingPlayerId: string,
  reason: 'left' | 'disconnected'
) {
  const record = activeGames.get(gameId);
  if (!record || record.isDisbanded) {
    if (playerToGameMap.get(leavingPlayerId) === gameId) {
      playerToGameMap.delete(leavingPlayerId);
    }
    return;
  }

  const pendingTimer = record.disconnectTimers.get(leavingPlayerId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    record.disconnectTimers.delete(leavingPlayerId);
  }

  const leavingPlayerIdx = record.state.players.findIndex(
    p => p.id === leavingPlayerId
  );
  if (leavingPlayerIdx === -1) return;

  const leavingPlayer = record.state.players[leavingPlayerIdx];
  if (leavingPlayer.hasLeft) return;

  if (playerToGameMap.get(leavingPlayerId) === gameId) {
    playerToGameMap.delete(leavingPlayerId);
  }

  // Close departing client's SSE connection
  const leavingClient = record.clients.get(leavingPlayerId);
  if (leavingClient) {
    try {
      leavingClient.end();
    } catch {}
    record.clients.delete(leavingPlayerId);
  }

  // Remove from Friendly Room membership if applicable
  if (record.state.roomCode) {
    const room = activeRooms.get(record.state.roomCode);
    if (room) {
      room.players = room.players.filter(p => p.id !== leavingPlayerId);
    }
  }

  // If match already naturally ended, just mark player left
  if (record.state.status === 'ended') {
    record.state = {
      ...record.state,
      players: record.state.players.map((p, idx) =>
        idx === leavingPlayerIdx ? { ...p, hasLeft: true } : p
      ),
    };
    return;
  }

  const updatedPlayers = record.state.players.map((p, idx) =>
    idx === leavingPlayerIdx ? { ...p, hasLeft: true } : p
  );

  const activeRemaining = updatedPlayers.filter(p => !p.hasLeft);
  if (activeRemaining.length <= 1) {
    record.state = {
      ...record.state,
      players: updatedPlayers,
    };

    const disbandMsg =
      record.state.playerCount === 2
        ? `${leavingPlayer.name} (opponent) left the match. The room has been disbanded.`
        : 'All other players have left the match. The room has been closed.';
    disbandGameAndRoom(gameId, disbandMsg);
    return;
  }

  // More than 1 active player remains (e.g. 4-player match with 2 or 3 still playing)
  const leaveAction =
    reason === 'disconnected'
      ? `${leavingPlayer.name} disconnected and was removed from the match.`
      : `${leavingPlayer.name} left the match.`;

  const wasLeavingPlayersTurn = record.state.currentTurnIndex === leavingPlayerIdx;
  const nextTurnIndex = wasLeavingPlayersTurn
    ? findNextActiveTurnIndex(updatedPlayers, leavingPlayerIdx)
    : record.state.currentTurnIndex;

  record.state = {
    ...record.state,
    players: updatedPlayers,
    currentTurnIndex: nextTurnIndex,
    lastAction: leaveAction,
    history: [leaveAction, ...record.state.history.slice(0, 19)],
  };
  record.lastActivity = Date.now();

  if (wasLeavingPlayersTurn) {
    startRollPhase(record);
  }

  broadcastGameState(gameId);
}

function startRollPhase(record: ActiveGameRecord) {
  clearTurnTimer(record);
  if (record.isDisbanded || record.state.status !== 'playing') return;

  const { players } = record.state;
  const activePlayers = players.filter(p => !p.hasLeft);
  if (activePlayers.length <= 1) {
    const disbandMsg =
      record.state.playerCount === 2
        ? 'Your opponent has left the match. The room has been disbanded.'
        : 'All other players have left the match. The room has been closed.';
    disbandGameAndRoom(record.state.gameId, disbandMsg);
    return;
  }

  let turnIdx = record.state.currentTurnIndex;
  if (
    !players[turnIdx] ||
    players[turnIdx].hasLeft ||
    players[turnIdx].isWinner
  ) {
    turnIdx = findNextActiveTurnIndex(players, turnIdx);
  }

  const currentPlayer = players[turnIdx];
  const now = Date.now();
  const turnId = `turn_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const diceDeadline = now + TURN_TIMEOUT_MS;

  record.state = {
    ...record.state,
    currentTurnIndex: turnIdx,
    currentPlayerId: currentPlayer.id,
    turnId,
    turnPhase: 'roll',
    turnStartedAt: now,
    diceDeadline,
    tokenDeadline: null,
    hasRolled: false,
    validMoves: [],
    isAutoMoving: false,
  };

  const gameId = record.state.gameId;
  record.turnTimer = setTimeout(() => {
    handleDiceTimeout(gameId, turnId);
  }, TURN_TIMEOUT_MS);
}

function startMovePhase(record: ActiveGameRecord, turnId: string) {
  clearTurnTimer(record);
  if (record.isDisbanded || record.state.status !== 'playing') return;

  const currentPlayer = record.state.players[record.state.currentTurnIndex];
  const now = Date.now();
  const tokenDeadline = now + TURN_TIMEOUT_MS;

  record.state = {
    ...record.state,
    currentPlayerId: currentPlayer.id,
    turnId,
    turnPhase: 'move',
    turnStartedAt: now,
    diceDeadline: null,
    tokenDeadline,
    isAutoMoving: false,
  };

  const gameId = record.state.gameId;
  record.turnTimer = setTimeout(() => {
    handleTokenTimeout(gameId, turnId);
  }, TURN_TIMEOUT_MS);
}

function executeAutoSingleTokenMove(
  gameId: string,
  expectedTurnId: string,
  tokenIndex: number
) {
  const record = activeGames.get(gameId);
  if (!record || record.isDisbanded || record.state.status !== 'playing') return;

  if (
    record.state.turnId !== expectedTurnId ||
    record.state.turnPhase !== 'move' ||
    !record.state.isAutoMoving ||
    !record.state.hasRolled ||
    record.state.diceValue === null
  ) {
    return;
  }

  performServerTokenMove(record, tokenIndex, false);
  broadcastGameState(gameId);
}

function performServerDiceRoll(
  record: ActiveGameRecord,
  isAuto: boolean
): { roll: number; validMoves: number[] } {
  clearTurnTimer(record);

  const { state } = record;
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
  // If player has EXACTLY 1 active token outside the starting yard and dice is 1..5 (NOT 6),
  // automatically select & move that single legal token without requiring manual click.
  const activeTokensOutsideYard = currentPlayer.tokens.filter(
    t => t.step >= 0 && t.step < 56
  );
  const shouldAutoMoveSingleToken =
    !shouldPassTurn &&
    roll >= 1 &&
    roll <= 5 &&
    activeTokensOutsideYard.length === 1 &&
    validMoves.length === 1;

  const activeTurnId =
    state.turnId ||
    `turn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  record.state = {
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
  record.lastActivity = Date.now();

  if (shouldPassTurn) {
    startRollPhase(record);
  } else if (shouldAutoMoveSingleToken) {
    const onlyTokenIndex = validMoves[0];
    record.state = {
      ...record.state,
      currentPlayerId: currentPlayer.id,
      turnId: activeTurnId,
      turnPhase: 'move',
      turnStartedAt: Date.now(),
      diceDeadline: null,
      tokenDeadline: null,
      isAutoMoving: true,
    };
    const gameId = record.state.gameId;
    record.autoMoveTimer = setTimeout(() => {
      executeAutoSingleTokenMove(gameId, activeTurnId, onlyTokenIndex);
    }, 550);
  } else {
    startMovePhase(record, activeTurnId);
  }

  return { roll, validMoves };
}

function performServerTokenMove(
  record: ActiveGameRecord,
  tokenIndex: number,
  isAuto: boolean
) {
  clearTurnTimer(record);

  const mover = record.state.players[record.state.currentTurnIndex];
  const { updatedState } = executeMove(record.state, tokenIndex);

  if (isAuto) {
    const autoMsg = `⏱️ Auto-move: ${updatedState.lastAction}`;
    updatedState.lastAction = autoMsg;
    updatedState.history = [autoMsg, ...updatedState.history.slice(1, 20)];
  }

  record.state = {
    ...updatedState,
    isAutoMoving: false,
    currentPlayerId: mover.id,
  };
  record.lastActivity = Date.now();

  if (record.state.status === 'playing') {
    startRollPhase(record);
  } else {
    record.state = {
      ...record.state,
      turnPhase: undefined,
      diceDeadline: null,
      tokenDeadline: null,
      isAutoMoving: false,
    };
  }
}

function handleDiceTimeout(gameId: string, expectedTurnId: string) {
  const record = activeGames.get(gameId);
  if (!record || record.isDisbanded || record.state.status !== 'playing') return;

  // Strictly validate turn ID & phase to guarantee zero duplicate auto-rolls
  if (
    record.state.turnId !== expectedTurnId ||
    record.state.turnPhase !== 'roll' ||
    record.state.hasRolled
  ) {
    return;
  }

  performServerDiceRoll(record, true);
  broadcastGameState(gameId);
}

function handleTokenTimeout(gameId: string, expectedTurnId: string) {
  const record = activeGames.get(gameId);
  if (!record || record.isDisbanded || record.state.status !== 'playing') return;

  // Strictly validate turn ID & phase to guarantee zero duplicate auto-moves
  if (
    record.state.turnId !== expectedTurnId ||
    record.state.turnPhase !== 'move' ||
    record.state.isAutoMoving ||
    !record.state.hasRolled ||
    record.state.diceValue === null
  ) {
    return;
  }

  const { validMoves } = record.state;
  if (!validMoves || validMoves.length === 0) {
    const nextIdx = findNextActiveTurnIndex(
      record.state.players,
      record.state.currentTurnIndex
    );
    record.state = {
      ...record.state,
      currentTurnIndex: nextIdx,
      hasRolled: false,
      validMoves: [],
      diceValue: null,
    };
    startRollPhase(record);
    broadcastGameState(gameId);
    return;
  }

  const chosenToken =
    validMoves.length === 1
      ? validMoves[0]
      : validMoves[Math.floor(Math.random() * validMoves.length)];

  performServerTokenMove(record, chosenToken, true);
  broadcastGameState(gameId);
}

// Generate unique clean room code like MUDO-8K29
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MUDO-${rand}`;
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// Firebase Status and configuration instructions
app.get('/api/firebase/status', (_req: Request, res: Response) => {
  const hasFirebaseConfig = Boolean(
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
  );
  res.json({
    configured: hasFirebaseConfig,
    provider: hasFirebaseConfig
      ? 'Firebase Firestore & Auth'
      : 'Native Authoritative Full-Stack Game Server',
    instructions:
      'Running with the built-in authoritative Node/Express multiplayer server. To additionally connect external Firebase Firestore, configure VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY, and VITE_FIREBASE_APP_ID.',
  });
});

// MATCHMAKING: Join Queue (Strictly unique player IDs and automatic unique colors per match)
app.post('/api/matchmaking/join', (req: Request, res: Response) => {
  const { playerId, playerName, targetCount } = req.body;
  if (!playerId || typeof playerId !== 'string' || (targetCount !== 2 && targetCount !== 4)) {
    return res.status(400).json({ error: 'Invalid matchmaking parameters' });
  }

  // Remove player if already in any waiting queue
  const idx2 = matchmakingQueue2P.findIndex(p => p.playerId === playerId);
  if (idx2 !== -1) matchmakingQueue2P.splice(idx2, 1);
  const idx4 = matchmakingQueue4P.findIndex(p => p.playerId === playerId);
  if (idx4 !== -1) matchmakingQueue4P.splice(idx4, 1);

  // Check if player already belongs to an active (in-progress) match
  const existingGameId = playerToGameMap.get(playerId);
  if (existingGameId) {
    const existingRecord = activeGames.get(existingGameId);
    if (
      existingRecord &&
      !existingRecord.isDisbanded &&
      existingRecord.state.status === 'playing' &&
      existingRecord.state.players.some(p => p.id === playerId && !p.hasLeft)
    ) {
      return res.json({ status: 'matched', gameId: existingGameId });
    }
    playerToGameMap.delete(playerId);
  }

  const cleanName =
    typeof playerName === 'string' && playerName.trim()
      ? playerName.trim().slice(0, 18)
      : 'Player';

  const queue = targetCount === 2 ? matchmakingQueue2P : matchmakingQueue4P;
  queue.push({
    playerId,
    playerName: cleanName,
    joinedAt: Date.now(),
  });

  // Check if we reached the required count (with unique playerIds)
  if (queue.length >= targetCount) {
    const matchedRaw = queue.splice(0, targetCount);
    const uniqueMatched: QueuePlayer[] = [];
    const seenIds = new Set<string>();
    for (const entry of matchedRaw) {
      if (!seenIds.has(entry.playerId)) {
        seenIds.add(entry.playerId);
        uniqueMatched.push(entry);
      }
    }

    if (uniqueMatched.length < targetCount) {
      queue.unshift(...uniqueMatched);
      return res.json({
        status: 'searching',
        playersFound: queue.length,
        targetCount,
      });
    }

    const gameId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const allowedColors: PlayerColor[] =
      targetCount === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

    // Server-authoritative automatic unique color assignment
    const assignedPlayers: Player[] = allowedColors.map((color, idx) => {
      const qp = uniqueMatched[idx];
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

    const uniqueColors = new Set(assignedPlayers.map(p => p.color));
    if (uniqueColors.size !== targetCount) {
      return res.status(500).json({ error: 'Color uniqueness validation failed' });
    }

    const initialGame = createInitialGameState('quick_match', targetCount, {
      gameId,
      playerNames: assignedPlayers.map(p => p.name),
    });

    initialGame.players = assignedPlayers;
    initialGame.lastAction = `Match started! ${assignedPlayers[0].name}'s turn to roll.`;
    initialGame.history = [
      `Match started in QUICK_MATCH mode with ${targetCount} players.`,
    ];

    const record: ActiveGameRecord = {
      state: initialGame,
      clients: new Map(),
      disconnectTimers: new Map(),
      isDisbanded: false,
      lastActivity: Date.now(),
    };

    activeGames.set(gameId, record);

    uniqueMatched.forEach(m => {
      playerToGameMap.set(m.playerId, gameId);
    });

    // Start authoritative 15-second turn roll timer immediately
    startRollPhase(record);

    return res.json({
      status: 'matched',
      gameId,
      playersFound: targetCount,
      targetCount,
    });
  }

  return res.json({
    status: 'searching',
    playersFound: queue.length,
    targetCount,
  });
});

// MATCHMAKING: Check status
app.get('/api/matchmaking/status', (req: Request, res: Response) => {
  const playerId = req.query.playerId as string;
  const targetCount = parseInt(req.query.targetCount as string, 10) as 2 | 4;

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID required' });
  }

  const gameId = playerToGameMap.get(playerId);
  if (gameId) {
    const rec = activeGames.get(gameId);
    if (rec && !rec.isDisbanded && rec.state.status === 'playing') {
      return res.json({ status: 'matched', gameId });
    }
  }

  const queue = targetCount === 2 ? matchmakingQueue2P : matchmakingQueue4P;
  const inQueue = queue.some(p => p.playerId === playerId);

  return res.json({
    status: inQueue ? 'searching' : 'idle',
    playersFound: queue.length,
    targetCount: targetCount || 2,
  });
});

// MATCHMAKING: Cancel / Leave Queue
app.post('/api/matchmaking/leave', (req: Request, res: Response) => {
  const { playerId, abandonActive } = req.body;
  if (!playerId) return res.status(400).json({ error: 'Player ID required' });

  const idx2 = matchmakingQueue2P.findIndex(p => p.playerId === playerId);
  if (idx2 !== -1) matchmakingQueue2P.splice(idx2, 1);
  const idx4 = matchmakingQueue4P.findIndex(p => p.playerId === playerId);
  if (idx4 !== -1) matchmakingQueue4P.splice(idx4, 1);

  if (abandonActive) {
    const existingGameId = playerToGameMap.get(playerId);
    if (existingGameId) {
      removePlayerFromActiveGame(existingGameId, playerId, 'left');
    } else {
      playerToGameMap.delete(playerId);
    }
  }

  res.json({ success: true });
});

// FRIENDLY ROOMS: Create Room
app.post('/api/rooms/create', (req: Request, res: Response) => {
  const { hostName, maxPlayers, playerId } = req.body;
  const count = (maxPlayers || 4) as 2 | 3 | 4;
  const pId = playerId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let code = generateRoomCode();
  while (activeRooms.has(code)) {
    code = generateRoomCode();
  }

  const room: RoomState = {
    code,
    hostId: pId,
    maxPlayers: count,
    players: [
      {
        id: pId,
        name: (typeof hostName === 'string' && hostName.trim()) ? hostName.trim().slice(0, 18) : 'Host',
        color: 'red',
        isHost: true,
        isReady: true,
        connectedAt: Date.now(),
      },
    ],
    status: 'waiting',
    createdAt: Date.now(),
  };

  activeRooms.set(code, room);
  res.json({ room, playerId: pId });
});

// FRIENDLY ROOMS: Join Room
app.post('/api/rooms/join', (req: Request, res: Response) => {
  const { roomCode, playerName, playerId } = req.body;
  if (!roomCode) {
    return res.status(400).json({ error: 'Room code is required' });
  }

  const code = (roomCode as string).trim().toUpperCase();
  const room = activeRooms.get(code);

  if (!room || room.status === 'disbanded') {
    return res.status(404).json({ error: 'Room not found or has been disbanded.' });
  }

  if (room.status === 'in_game') {
    return res.status(400).json({ error: 'Game has already started in this room.' });
  }

  const pId = playerId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const existing = room.players.find(p => p.id === pId);

  if (!existing && room.players.length >= room.maxPlayers) {
    return res.status(400).json({ error: 'This room is already full.' });
  }

  if (!existing) {
    const availableColors: PlayerColor[] =
      room.maxPlayers === 2
        ? ['red', 'yellow']
        : room.maxPlayers === 3
        ? ['red', 'green', 'yellow']
        : ['red', 'green', 'yellow', 'blue'];

    const usedColors = new Set(room.players.map(p => p.color));
    const assignedColor = availableColors.find(c => !usedColors.has(c)) || 'blue';

    const cleanName =
      typeof playerName === 'string' && playerName.trim()
        ? playerName.trim().slice(0, 18)
        : `Player ${room.players.length + 1}`;

    room.players.push({
      id: pId,
      name: cleanName,
      color: assignedColor,
      isHost: false,
      isReady: true,
      connectedAt: Date.now(),
    });
  }

  // Check if room is now full! If so, initialize game & start 15s turn timer
  if (room.players.length === room.maxPlayers && !room.gameId) {
    const gameId = `roomgame_${code}_${Date.now()}`;
    const initialGame = createInitialGameState('friendly', room.maxPlayers, {
      gameId,
      roomCode: code,
      playerNames: room.players.map(p => p.name),
    });

    initialGame.players = room.players.map(rp => ({
      id: rp.id,
      name: rp.name,
      color: rp.color,
      type: 'remote',
      tokens: [0, 1, 2, 3].map(id => createToken(id, rp.color)),
      isWinner: false,
      hasLeft: false,
    }));

    const record: ActiveGameRecord = {
      state: initialGame,
      clients: new Map(),
      disconnectTimers: new Map(),
      isDisbanded: false,
      lastActivity: Date.now(),
    };

    activeGames.set(gameId, record);

    room.status = 'in_game';
    room.gameId = gameId;

    // Start authoritative 15-second turn roll timer immediately
    startRollPhase(record);
  }

  res.json({ room, playerId: pId, gameId: room.gameId });
});

// FRIENDLY ROOMS: Get Room Info
app.get('/api/rooms/:code', (req: Request, res: Response) => {
  const code = req.params.code.toUpperCase();
  const room = activeRooms.get(code);
  if (!room || room.status === 'disbanded') {
    return res.status(404).json({ error: 'Room not found or disbanded' });
  }
  res.json({ room });
});

// FRIENDLY ROOMS: Leave Waiting Room
app.post('/api/rooms/:code/leave', (req: Request, res: Response) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body;
  const room = activeRooms.get(code);

  if (room) {
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      room.status = 'disbanded';
      activeRooms.delete(code);
    } else if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
  }

  res.json({ success: true });
});

// GAME: Get Current State (stamped with serverNow)
app.get('/api/game/:id', (req: Request, res: Response) => {
  const gameId = req.params.id;
  const record = activeGames.get(gameId);
  if (!record) {
    return res.status(404).json({ error: 'Game not found' });
  }
  res.json(stampState(record.state));
});

// GAME: Presence Heartbeat
app.post('/api/game/:id/heartbeat', (req: Request, res: Response) => {
  const gameId = req.params.id;
  const { playerId } = req.body;
  const record = activeGames.get(gameId);
  if (!record) {
    return res.status(404).json({ error: 'Game not found' });
  }
  if (playerId) {
    const pending = record.disconnectTimers.get(playerId);
    if (pending) {
      clearTimeout(pending);
      record.disconnectTimers.delete(playerId);
    }
  }
  record.lastActivity = Date.now();
  res.json({ ok: true, serverNow: Date.now() });
});

// GAME: Intentional Player Leave (triggers immediate room disband check)
app.post('/api/game/:id/leave', (req: Request, res: Response) => {
  const gameId = req.params.id;
  const { playerId } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'Player ID required' });
  }

  removePlayerFromActiveGame(gameId, playerId, 'left');
  res.json({ success: true });
});

// GAME: Server-Sent Events (SSE) Stream with Reconnect Preservation & Disconnect Detection
app.get('/api/game/:id/stream', (req: Request, res: Response) => {
  const gameId = req.params.id;
  const playerId = (req.query.playerId as string) || `guest_${Date.now()}`;
  const record = activeGames.get(gameId);

  if (!record) {
    return res.status(404).send('Game not found');
  }

  // Cancel any pending confirmed-disconnect timer on reconnect (do NOT reset active turn timer)
  const pendingTimer = record.disconnectTimers.get(playerId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    record.disconnectTimers.delete(playerId);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  record.clients.set(playerId, res);

  // Send authoritative state with current server timestamp immediately on connect/reconnect
  res.write(`data: ${JSON.stringify(stampState(record.state))}\n\n`);

  req.on('close', () => {
    // Only process close if this response is still the latest registered stream for playerId
    if (record.clients.get(playerId) === res) {
      record.clients.delete(playerId);
    }

    const isKnownPlayer = record.state.players.some(
      p => p.id === playerId && !p.hasLeft
    );
    if (isKnownPlayer && !record.isDisbanded && record.state.status === 'playing') {
      if (!record.disconnectTimers.has(playerId)) {
        const timer = setTimeout(() => {
          record.disconnectTimers.delete(playerId);
          // Confirmed disconnection: player did not reconnect within grace period
          if (!record.clients.has(playerId)) {
            removePlayerFromActiveGame(gameId, playerId, 'disconnected');
          }
        }, DISCONNECT_CONFIRM_MS);
        record.disconnectTimers.set(playerId, timer);
      }
    }
  });
});

// GAME: Roll Dice (Server Authoritative — 1 roll per turn)
app.post('/api/game/:id/roll', (req: Request, res: Response) => {
  const gameId = req.params.id;
  const { playerId } = req.body;
  const record = activeGames.get(gameId);

  if (!record) {
    return res.status(404).json({ error: 'Game not found' });
  }
  if (record.isDisbanded || record.state.status !== 'playing') {
    return res.status(400).json({ error: 'Match is no longer active' });
  }

  const { state } = record;
  const currentPlayer = state.players[state.currentTurnIndex];

  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.hasLeft) {
    return res.status(403).json({
      error: `Not your turn. Current turn: ${currentPlayer?.name || 'Opponent'}`,
    });
  }

  if (state.hasRolled || state.turnPhase !== 'roll') {
    return res.status(400).json({ error: 'Dice already rolled for this turn' });
  }

  const { roll, validMoves } = performServerDiceRoll(record, false);
  broadcastGameState(gameId);

  res.json({ roll, validMoves, state: stampState(record.state) });
});

// GAME: Move Token (Server Validated — 1 move per roll)
app.post('/api/game/:id/move', (req: Request, res: Response) => {
  const gameId = req.params.id;
  const { playerId, tokenIndex } = req.body;
  const record = activeGames.get(gameId);

  if (!record) {
    return res.status(404).json({ error: 'Game not found' });
  }
  if (record.isDisbanded || record.state.status !== 'playing') {
    return res.status(400).json({ error: 'Match is no longer active' });
  }

  const { state } = record;
  const currentPlayer = state.players[state.currentTurnIndex];

  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.hasLeft) {
    return res.status(403).json({ error: 'Not your turn' });
  }

  if (!state.hasRolled || state.turnPhase !== 'move' || state.diceValue === null) {
    return res.status(400).json({ error: 'You must roll the dice first' });
  }

  if (state.isAutoMoving) {
    return res.status(400).json({ error: 'Automatic single-token move in progress' });
  }

  if (!state.validMoves.includes(tokenIndex)) {
    return res.status(400).json({ error: 'Invalid move for selected token' });
  }

  performServerTokenMove(record, tokenIndex, false);
  broadcastGameState(gameId);

  res.json({ state: stampState(record.state) });
});

// Clean up stale rooms and games periodically
setInterval(() => {
  const now = Date.now();
  activeGames.forEach((rec, id) => {
    if (now - rec.lastActivity > 2 * 60 * 60 * 1000) {
      clearTurnTimer(rec);
      rec.disconnectTimers.forEach(t => clearTimeout(t));
      rec.disconnectTimers.clear();
      activeGames.delete(id);
    }
  });
  activeRooms.forEach((rm, code) => {
    if (now - rm.createdAt > 3 * 60 * 60 * 1000) {
      activeRooms.delete(code);
    }
  });
}, 10 * 60 * 1000);

// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVE
// -------------------------------------------------------------
app.use(express.static(path.resolve(__dirname, 'public')));

async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MUDO] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
