/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GameState, PlayerColor } from '../../types/ludo';
import { AnimatingTokenInfo, Board } from '../Board';
import { Dice } from '../Dice';
import { WinnerModal } from '../modals/WinnerModal';
import { PauseModal } from '../modals/PauseModal';
import {
  executeMove,
  getBoardRotationDeg,
  getRotatedCornerColors,
  getValidMoves,
  selectBestAIMove,
} from '../../utils/ludoEngine';
import { sounds } from '../../utils/soundEffects';
import { getEstimatedServerNow } from '../../services/firebase';
import {
  checkOnlinePeerDisconnects,
  claimOnlineTurnTimeout,
  executeOnlineAutoSingleMove,
  moveOnlineToken,
  removeOnlinePlayer,
  rollOnlineDice,
  sendGamePresenceHeartbeat,
  subscribeToGame,
} from '../../services/onlineMultiplayer';
import { AlertTriangle, Clock, Pause } from 'lucide-react';

interface GameBoardScreenProps {
  initialGameState: GameState;
  playerId: string;
  onHome: () => void;
  onReturnToOnlineMenu?: () => void;
  onHowToPlay: () => void;
  isSoundMuted: boolean;
  onToggleSound: () => void;
}

const FORWARD_STEP_MS = 145;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function updateTokenStepInState(
  state: GameState,
  color: PlayerColor,
  tokenId: number,
  step: number
): GameState {
  return {
    ...state,
    players: state.players.map(p => {
      if (p.color !== color) return p;
      return {
        ...p,
        tokens: p.tokens.map(t => {
          if (t.id !== tokenId) return t;
          return {
            ...t,
            step,
            isYard: step === -1,
            isHome: step >= 56,
          };
        }),
      };
    }),
  };
}

function buildPreMoveSnapshot(finalState: GameState): GameState {
  const move = finalState.lastMove;
  if (!move) return finalState;

  const moverPlayerIndex = finalState.players.findIndex(
    p => p.id === move.playerId || p.color === move.color
  );

  const restoredPlayers = finalState.players.map(p => ({
    ...p,
    tokens: p.tokens.map(t => {
      if (p.color === move.color && t.id === move.tokenId) {
        return {
          ...t,
          step: move.fromStep,
          isYard: move.fromStep === -1,
          isHome: move.fromStep >= 56,
        };
      }
      const captured = move.capturedTokens.find(
        c => c.color === p.color && c.tokenId === t.id
      );
      if (captured) {
        return {
          ...t,
          step: captured.fromStep,
          isYard: false,
          isHome: false,
        };
      }
      return { ...t };
    }),
  }));

  return {
    ...finalState,
    players: restoredPlayers,
    currentTurnIndex:
      moverPlayerIndex >= 0 ? moverPlayerIndex : finalState.currentTurnIndex,
    hasRolled: false,
    validMoves: [],
    status: 'playing',
    winner: null,
  };
}

export const GameBoardScreen: React.FC<GameBoardScreenProps> = ({
  initialGameState,
  playerId,
  onHome,
  onReturnToOnlineMenu,
  onHowToPlay,
  isSoundMuted,
  onToggleSound,
}) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [displayGameState, setDisplayGameState] = useState<GameState>(initialGameState);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isRollingAnimation, setIsRollingAnimation] = useState<boolean>(false);
  const [isAnimatingMove, setIsAnimatingMove] = useState<boolean>(false);
  const [animatingToken, setAnimatingToken] = useState<AnimatingTokenInfo | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [disbandRedirectSec, setDisbandRedirectSec] = useState<number>(5);

  const isAnimatingMoveRef = useRef<boolean>(false);
  const lastAnimatedMoveIdRef = useRef<string | null>(
    initialGameState.lastMove?.moveId || null
  );
  const queuedIncomingStateRef = useRef<GameState | null>(null);
  const animationRunIdRef = useRef<number>(0);
  const serverClockOffsetRef = useRef<number>(
    initialGameState.serverNow ? initialGameState.serverNow - Date.now() : 0
  );
  const latestServerNowRef = useRef<number>(initialGameState.serverNow || 0);
  const lastTurnPhaseRef = useRef<string | undefined>(initialGameState.turnPhase);
  const manualRollInFlightRef = useRef<boolean>(false);

  const isOnlineMode =
    gameState.mode === 'quick_match' || gameState.mode === 'friendly';
  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const displayPlayer = displayGameState.players[displayGameState.currentTurnIndex];

  // Visual orientation: in online modes, local player's color ALWAYS appears at bottom-left
  const localOnlinePlayer = isOnlineMode
    ? displayGameState.players.find(p => p.id === playerId)
    : undefined;
  const viewColor: PlayerColor =
    isOnlineMode && localOnlinePlayer ? localOnlinePlayer.color : 'red';
  const boardRotationDeg = isOnlineMode ? getBoardRotationDeg(viewColor) : 0;
  const cornerColors = getRotatedCornerColors(viewColor);

  useEffect(() => {
    return () => {
      animationRunIdRef.current += 1;
    };
  }, []);

  const runMoveAnimationSequence = useCallback(async (finalState: GameState) => {
    const move = finalState.lastMove;
    if (!move) {
      setDisplayGameState(finalState);
      return;
    }

    lastAnimatedMoveIdRef.current = move.moveId;
    const runId = ++animationRunIdRef.current;
    isAnimatingMoveRef.current = true;
    setIsAnimatingMove(true);

    let workingState = buildPreMoveSnapshot(finalState);
    setDisplayGameState(workingState);

    await sleep(30);
    if (animationRunIdRef.current !== runId) return;

    // 1. Forward step-by-step movement animation
    const forwardSteps =
      move.fromStep === -1
        ? [0]
        : Array.from(
            { length: Math.max(0, move.toStep - move.fromStep) },
            (_, idx) => move.fromStep + idx + 1
          );

    setAnimatingToken({
      color: move.color,
      tokenId: move.tokenId,
      mode: 'forward',
      durationMs: FORWARD_STEP_MS,
    });

    for (const step of forwardSteps) {
      if (animationRunIdRef.current !== runId) return;
      workingState = updateTokenStepInState(workingState, move.color, move.tokenId, step);
      setDisplayGameState(workingState);
      sounds.playTokenStep();
      await sleep(FORWARD_STEP_MS);
    }

    if (animationRunIdRef.current !== runId) return;

    // 2. Capture reverse step-by-step animation back to exact original yard slot (~86% duration)
    if (move.capturedTokens.length > 0) {
      sounds.playCapture();
      await sleep(95);

      for (const captured of move.capturedTokens) {
        if (animationRunIdRef.current !== runId) return;

        const reverseSteps: number[] = [];
        for (let s = captured.fromStep - 1; s >= 0; s--) {
          reverseSteps.push(s);
        }
        reverseSteps.push(-1);

        const stepCount = reverseSteps.length;
        const reverseStepMs =
          stepCount <= 10
            ? 82
            : stepCount <= 22
            ? 56
            : Math.max(33, Math.floor(1480 / stepCount));

        setAnimatingToken({
          color: captured.color,
          tokenId: captured.tokenId,
          mode: 'reverse',
          durationMs: reverseStepMs,
        });

        for (const revStep of reverseSteps) {
          if (animationRunIdRef.current !== runId) return;
          workingState = updateTokenStepInState(
            workingState,
            captured.color,
            captured.tokenId,
            revStep
          );
          setDisplayGameState(workingState);
          await sleep(reverseStepMs);
        }
      }
    }

    if (animationRunIdRef.current !== runId) return;

    setAnimatingToken(null);
    if (move.reachedHome) {
      sounds.playHomeChime();
    }
    if (finalState.status === 'ended') {
      sounds.playWin();
    }

    setDisplayGameState(finalState);
    isAnimatingMoveRef.current = false;
    setIsAnimatingMove(false);

    const pending = queuedIncomingStateRef.current;
    queuedIncomingStateRef.current = null;
    if (pending) {
      if (
        pending.lastMove &&
        pending.lastMove.moveId !== lastAnimatedMoveIdRef.current
      ) {
        void runMoveAnimationSequence(pending);
      } else {
        setDisplayGameState(pending);
      }
    }
  }, []);

  const applyAuthoritativeState = useCallback(
    (incoming: GameState) => {
      if (typeof incoming.serverNow === 'number') {
        if (incoming.serverNow < latestServerNowRef.current) {
          return;
        }
        latestServerNowRef.current = incoming.serverNow;
        serverClockOffsetRef.current = incoming.serverNow - Date.now();
      }

      // Play dice sound when remote or auto-roll happens
      if (
        lastTurnPhaseRef.current === 'roll' &&
        incoming.turnPhase === 'move' &&
        !manualRollInFlightRef.current
      ) {
        sounds.playDiceRoll();
      }
      lastTurnPhaseRef.current = incoming.turnPhase;
      manualRollInFlightRef.current = false;

      setGameState(incoming);

      if (isAnimatingMoveRef.current) {
        queuedIncomingStateRef.current = incoming;
        return;
      }

      if (
        incoming.lastMove &&
        incoming.lastMove.moveId !== lastAnimatedMoveIdRef.current
      ) {
        void runMoveAnimationSequence(incoming);
      } else {
        setDisplayGameState(incoming);
      }
    },
    [runMoveAnimationSequence]
  );

  const gameCreatedAtRef = useRef<number>(Date.now());
  const latestGameStatusRef = useRef(gameState.status);
  latestGameStatusRef.current = gameState.status;
  const latestGamePlayersRef = useRef(gameState.players);
  latestGamePlayersRef.current = gameState.players;

  // Real-time Firestore synchronization + presence heartbeat + disconnect detection
  useEffect(() => {
    if (!isOnlineMode) return;

    const unsubscribe = subscribeToGame(gameState.gameId, {
      onState: updated => {
        applyAuthoritativeState(updated);
      },
      onError: () => {
        // Firestore real-time listener handles reconnect automatically
      },
    });

    void sendGamePresenceHeartbeat(gameState.gameId, playerId);

    const heartbeat = setInterval(() => {
      void sendGamePresenceHeartbeat(gameState.gameId, playerId);
    }, 4000);

    const peerCheck = setInterval(() => {
      if (latestGameStatusRef.current === 'playing') {
        void checkOnlinePeerDisconnects(
          gameState.gameId,
          playerId,
          latestGamePlayersRef.current,
          gameCreatedAtRef.current
        );
      }
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(peerCheck);
      unsubscribe();
    };
  }, [
    isOnlineMode,
    gameState.gameId,
    playerId,
    applyAuthoritativeState,
  ]);

  // Automatic single-token movement execution in online modes (rolls 1-5 with 1 token out)
  useEffect(() => {
    if (
      !isOnlineMode ||
      gameState.status !== 'playing' ||
      !gameState.isAutoMoving ||
      gameState.turnPhase !== 'move' ||
      !gameState.turnId ||
      gameState.validMoves.length !== 1
    ) {
      return;
    }

    const activePlayer = gameState.players[gameState.currentTurnIndex];
    const isMyTurn = activePlayer?.id === playerId;
    const delayMs = isMyTurn ? 550 : 1700;
    const expectedTurnId = gameState.turnId;
    const onlyTokenIndex = gameState.validMoves[0];

    const timer = setTimeout(() => {
      void executeOnlineAutoSingleMove(
        gameState.gameId,
        expectedTurnId,
        onlyTokenIndex
      );
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    isOnlineMode,
    gameState.gameId,
    gameState.status,
    gameState.isAutoMoving,
    gameState.turnPhase,
    gameState.turnId,
    gameState.validMoves,
    gameState.players,
    gameState.currentTurnIndex,
    playerId,
  ]);

  // 15-second turn countdown & atomic server-time timeout enforcement
  useEffect(() => {
    if (!isOnlineMode || displayGameState.status !== 'playing') {
      setRemainingSeconds(null);
      return;
    }

    const activeDeadline =
      displayGameState.turnPhase === 'move'
        ? displayGameState.tokenDeadline
        : displayGameState.diceDeadline;

    if (!activeDeadline) {
      setRemainingSeconds(null);
      return;
    }

    const activePlayer = gameState.players[gameState.currentTurnIndex];
    const isMyTurn = activePlayer?.id === playerId;
    let timeoutClaimed = false;

    const updateRemaining = () => {
      const estimatedNow = getEstimatedServerNow();
      const secs = Math.max(
        0,
        Math.min(15, Math.ceil((activeDeadline - estimatedNow) / 1000))
      );
      setRemainingSeconds(secs);

      const graceDelayMs = isMyTurn ? 300 : 1200;
      if (
        !timeoutClaimed &&
        !gameState.isAutoMoving &&
        gameState.turnId &&
        gameState.turnPhase &&
        estimatedNow >= activeDeadline + graceDelayMs
      ) {
        timeoutClaimed = true;
        void claimOnlineTurnTimeout(
          gameState.gameId,
          gameState.turnId,
          gameState.turnPhase
        );
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 250);
    return () => clearInterval(timer);
  }, [
    isOnlineMode,
    displayGameState.status,
    displayGameState.turnPhase,
    displayGameState.diceDeadline,
    displayGameState.tokenDeadline,
    gameState.gameId,
    gameState.turnId,
    gameState.turnPhase,
    gameState.isAutoMoving,
    gameState.players,
    gameState.currentTurnIndex,
    playerId,
  ]);

  // Auto-return remaining player to online menu after room disbands
  useEffect(() => {
    if (displayGameState.status !== 'disbanded') return;

    setDisbandRedirectSec(5);
    const interval = setInterval(() => {
      setDisbandRedirectSec(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          (onReturnToOnlineMenu || onHome)();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [displayGameState.status, onHome, onReturnToOnlineMenu]);

  const handleLeaveMatch = useCallback(async () => {
    if (isOnlineMode && gameState.status === 'playing') {
      await removeOnlinePlayer(gameState.gameId, playerId, 'left');
    }
    onHome();
  }, [gameState.gameId, gameState.status, isOnlineMode, onHome, playerId]);

  // Handle Token Click & Movement
  const handleTokenMove = useCallback(
    async (tokenIndex: number) => {
      if (isRollingAnimation || isAnimatingMoveRef.current) return;
      if (gameState.status !== 'playing') return;

      if (isOnlineMode) {
        const nextState = await moveOnlineToken(
          gameState.gameId,
          playerId,
          tokenIndex
        );
        if (nextState) {
          applyAuthoritativeState(nextState);
        }
        return;
      }

      // Offline / AI mode client-side execution
      try {
        const { updatedState } = executeMove(gameState, tokenIndex);
        applyAuthoritativeState(updatedState);
      } catch (err) {
        console.error(err);
      }
    },
    [
      applyAuthoritativeState,
      gameState,
      isOnlineMode,
      isRollingAnimation,
      playerId,
    ]
  );

  // Handle Dice Roll
  const handleRoll = useCallback(async () => {
    if (
      gameState.hasRolled ||
      isRollingAnimation ||
      isAnimatingMoveRef.current ||
      gameState.status !== 'playing'
    ) {
      return;
    }

    sounds.playDiceRoll();
    setIsRollingAnimation(true);

    if (isOnlineMode) {
      manualRollInFlightRef.current = true;
      const rollStartedAt = Date.now();
      try {
        const nextState = await rollOnlineDice(gameState.gameId, playerId);
        const remainingSpin = Math.max(0, 400 - (Date.now() - rollStartedAt));
        setTimeout(() => {
          setIsRollingAnimation(false);
          if (nextState) {
            applyAuthoritativeState(nextState);
          } else {
            manualRollInFlightRef.current = false;
          }
        }, remainingSpin);
      } catch {
        manualRollInFlightRef.current = false;
        setIsRollingAnimation(false);
      }
      return;
    }

    // Offline / AI roll logic
    setTimeout(() => {
      setIsRollingAnimation(false);
      const roll = Math.floor(Math.random() * 6) + 1;
      const valid = getValidMoves(currentPlayer, roll);

      let nextConsecutive = roll === 6 ? gameState.consecutiveSixes + 1 : 0;
      let nextTurnIndex = gameState.currentTurnIndex;
      let action = `${currentPlayer.name} rolled a ${roll}.`;

      if (nextConsecutive >= 3) {
        action = `⚠️ ${currentPlayer.name} rolled three 6s! Turn forfeited.`;
        nextConsecutive = 0;
        for (let i = 1; i <= gameState.players.length; i++) {
          const candidate = (gameState.currentTurnIndex + i) % gameState.players.length;
          if (!gameState.players[candidate].isWinner) {
            nextTurnIndex = candidate;
            break;
          }
        }
      } else if (valid.length === 0) {
        action = `${currentPlayer.name} rolled a ${roll} with no valid moves.`;

        for (let i = 1; i <= gameState.players.length; i++) {
          const candidate = (gameState.currentTurnIndex + i) % gameState.players.length;
          if (!gameState.players[candidate].isWinner) {
            nextTurnIndex = candidate;
            break;
          }
        }
      }

      const updated: GameState = {
        ...gameState,
        diceValue: roll,
        hasRolled: valid.length > 0 && nextConsecutive < 3,
        validMoves: nextConsecutive >= 3 ? [] : valid,
        currentTurnIndex:
          valid.length === 0 || nextConsecutive >= 3
            ? nextTurnIndex
            : gameState.currentTurnIndex,
        consecutiveSixes: nextConsecutive,
        lastAction: action,
        history: [action, ...gameState.history.slice(0, 19)],
      };

      applyAuthoritativeState(updated);

      // Auto-move if exactly 1 valid move in offline or AI mode for snappy gameplay
      if (valid.length === 1 && currentPlayer.type === 'human' && nextConsecutive < 3) {
        setTimeout(() => {
          if (isAnimatingMoveRef.current) return;
          const { updatedState } = executeMove(updated, valid[0]);
          applyAuthoritativeState(updatedState);
        }, 350);
      }
    }, 450);
  }, [
    applyAuthoritativeState,
    currentPlayer,
    gameState,
    isOnlineMode,
    isRollingAnimation,
    playerId,
  ]);

  // Keyboard shortcut: Spacebar to roll dice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !isPaused &&
        !isRollingAnimation &&
        !isAnimatingMove &&
        gameState.status === 'playing'
      ) {
        const canRollNow =
          !gameState.hasRolled &&
          (gameState.mode === 'offline' ||
            (gameState.mode === 'ai' && currentPlayer.type === 'human') ||
            (isOnlineMode && currentPlayer.id === playerId));

        if (canRollNow) {
          e.preventDefault();
          handleRoll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPlayer,
    gameState.hasRolled,
    gameState.mode,
    gameState.status,
    handleRoll,
    isAnimatingMove,
    isOnlineMode,
    isPaused,
    isRollingAnimation,
    playerId,
  ]);

  // AI Turn Handling (Automatic dice roll + move, strictly waits for any running animation)
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    if (currentPlayer.type !== 'ai' || isPaused) return;
    if (isAnimatingMove || isRollingAnimation || gameState.hasRolled) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const rollTimer = setTimeout(() => {
      if (cancelled || isAnimatingMoveRef.current) return;
      sounds.playDiceRoll();
      setIsRollingAnimation(true);

      const finishRollTimer = setTimeout(() => {
        if (cancelled) return;
        setIsRollingAnimation(false);

        const roll = Math.floor(Math.random() * 6) + 1;
        const valid = getValidMoves(currentPlayer, roll);

        let nextTurn = gameState.currentTurnIndex;
        let action = `${currentPlayer.name} rolled a ${roll}.`;

        if (valid.length === 0) {
          action = `${currentPlayer.name} rolled a ${roll} (no moves).`;
          for (let i = 1; i <= gameState.players.length; i++) {
            const cand = (gameState.currentTurnIndex + i) % gameState.players.length;
            if (!gameState.players[cand].isWinner) {
              nextTurn = cand;
              break;
            }
          }

          applyAuthoritativeState({
            ...gameState,
            diceValue: roll,
            hasRolled: false,
            validMoves: [],
            currentTurnIndex: nextTurn,
            lastAction: action,
            history: [action, ...gameState.history.slice(0, 19)],
          });
        } else {
          const chosenToken = selectBestAIMove(
            { ...gameState, diceValue: roll },
            valid,
            gameState.aiDifficulty || 'medium'
          );

          const interimState: GameState = {
            ...gameState,
            diceValue: roll,
            hasRolled: true,
            validMoves: valid,
            lastAction: action,
            history: [action, ...gameState.history.slice(0, 19)],
          };
          applyAuthoritativeState(interimState);

          const moveTimer = setTimeout(() => {
            if (cancelled) return;
            const { updatedState } = executeMove(interimState, chosenToken);
            applyAuthoritativeState(updatedState);
          }, 550);
          timers.push(moveTimer);
        }
      }, 450);
      timers.push(finishRollTimer);
    }, 650);
    timers.push(rollTimer);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [
    applyAuthoritativeState,
    currentPlayer,
    gameState,
    isAnimatingMove,
    isPaused,
    isRollingAnimation,
  ]);

  // Determine if active user can roll or move right now
  const canUserRoll =
    gameState.status === 'playing' &&
    !gameState.hasRolled &&
    !isRollingAnimation &&
    !isAnimatingMove &&
    (gameState.mode === 'offline' ||
      (gameState.mode === 'ai' && currentPlayer.type === 'human') ||
      (isOnlineMode && currentPlayer.id === playerId));

  const canUserInteractWithBoard =
    gameState.status === 'playing' &&
    gameState.hasRolled &&
    !gameState.isAutoMoving &&
    !displayGameState.isAutoMoving &&
    !isRollingAnimation &&
    !isAnimatingMove &&
    (gameState.mode === 'offline' ||
      (gameState.mode === 'ai' && currentPlayer.type === 'human') ||
      (isOnlineMode && currentPlayer.id === playerId));

  const handleRestart = () => {
    animationRunIdRef.current += 1;
    queuedIncomingStateRef.current = null;
    isAnimatingMoveRef.current = false;
    lastAnimatedMoveIdRef.current = null;
    setIsAnimatingMove(false);
    setAnimatingToken(null);
    setIsRollingAnimation(false);
    setIsPaused(false);

    const resetPlayers = gameState.players.map(p => ({
      ...p,
      tokens: p.tokens.map(t => ({
        ...t,
        step: -1,
        isHome: false,
        isYard: true,
      })),
      isWinner: false,
      rank: undefined,
    }));

    const freshState: GameState = {
      ...gameState,
      players: resetPlayers,
      currentTurnIndex: 0,
      diceValue: null,
      hasRolled: false,
      validMoves: [],
      consecutiveSixes: 0,
      status: 'playing',
      winners: [],
      winner: null,
      lastAction: 'Match restarted!',
      history: ['Match restarted.'],
      lastMove: undefined,
    };

    setGameState(freshState);
    setDisplayGameState(freshState);
  };

  // Compact exterior timer badge shown beside/below active player's dice in online modes
  const renderTimerBadge = () => {
    if (
      !isOnlineMode ||
      displayGameState.status !== 'playing' ||
      remainingSeconds === null
    ) {
      return null;
    }

    const isUrgent = remainingSeconds <= 5;
    const phaseLabel = displayGameState.turnPhase === 'move' ? 'Move' : 'Roll';

    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold tabular-nums transition-colors ${
          isUrgent
            ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse shadow-md shadow-rose-950/60'
            : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
        }`}
        title={`${phaseLabel} timer: ${remainingSeconds}s remaining`}
      >
        <Clock className={`w-3 h-3 ${isUrgent ? 'text-rose-400' : 'text-amber-400'}`} />
        <span>{remainingSeconds}s</span>
      </div>
    );
  };

  // Helper to render the active player's dice slot strictly outside their visual corner
  const renderDiceSlot = (
    cornerColor: PlayerColor,
    size: 'sm' | 'md',
    alignSide: 'left' | 'right'
  ) => {
    const isCornerActive =
      displayGameState.status === 'playing' && displayPlayer?.color === cornerColor;
    const slotDim = size === 'sm' ? 'h-12 min-w-12' : 'w-16 min-h-16';

    if (!isCornerActive) {
      return <div className={`${slotDim} shrink-0`} aria-hidden="true" />;
    }

    if (size === 'sm') {
      return (
        <div
          className={`h-12 shrink-0 flex items-center gap-2 animate-fadeIn ${
            alignSide === 'right' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <Dice
            value={displayGameState.diceValue}
            isRolling={isRollingAnimation}
            canRoll={canUserRoll}
            playerColor={cornerColor}
            onRoll={handleRoll}
            size="sm"
            hideLabel={true}
          />
          {renderTimerBadge()}
        </div>
      );
    }

    return (
      <div className="w-16 shrink-0 flex flex-col items-center justify-center gap-1.5 animate-fadeIn">
        <Dice
          value={displayGameState.diceValue}
          isRolling={isRollingAnimation}
          canRoll={canUserRoll}
          playerColor={cornerColor}
          onRoll={handleRoll}
          size="md"
          hideLabel={true}
        />
        {renderTimerBadge()}
      </div>
    );
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col justify-between px-3 sm:px-6 py-2.5 sm:py-4 overflow-x-hidden">
      {/* Gameplay Header: TOP-LEFT MUDO Logo (+ discreet BY MUBIX), TOP-RIGHT Pause Button */}
      <header className="w-full flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/logo.png"
            alt="MUDO"
            className="h-7 sm:h-8 w-auto object-contain shrink-0"
          />
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400/80 font-semibold whitespace-nowrap">
            BY MUBIX
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setIsPaused(true);
          }}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-all cursor-pointer active:scale-95 shadow-md shrink-0"
          title="Pause"
          aria-label="Pause Game"
        >
          <Pause className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
        </button>
      </header>

      {/* Centered Game Arena: Board + Exterior Active Corner Dice */}
      <div className="flex-1 flex flex-col items-center justify-center py-2">
        {/* Mobile Layout (< md): Top Dice Row, Board, Bottom Dice Row */}
        <div className="w-full flex flex-col items-center gap-3 md:hidden">
          <div className="w-full max-w-[min(94vw,calc(100dvh-200px))] flex items-center justify-between px-1">
            {renderDiceSlot(cornerColors.topLeft, 'sm', 'left')}
            {renderDiceSlot(cornerColors.topRight, 'sm', 'right')}
          </div>

          <div className="w-[min(94vw,calc(100dvh-200px))] aspect-square shrink-0">
            <Board
              gameState={displayGameState}
              onTokenClick={handleTokenMove}
              canInteract={canUserInteractWithBoard}
              activeColor={displayPlayer.color}
              animatingToken={animatingToken}
              rotationDeg={boardRotationDeg}
            />
          </div>

          <div className="w-full max-w-[min(94vw,calc(100dvh-200px))] flex items-center justify-between px-1">
            {renderDiceSlot(cornerColors.bottomLeft, 'sm', 'left')}
            {renderDiceSlot(cornerColors.bottomRight, 'sm', 'right')}
          </div>
        </div>

        {/* Desktop Layout (md+): Left Dice Column, Center Board, Right Dice Column */}
        <div className="hidden md:flex items-stretch justify-center gap-4 lg:gap-6">
          <div className="flex flex-col justify-between py-2 shrink-0">
            {renderDiceSlot(cornerColors.topLeft, 'md', 'left')}
            {renderDiceSlot(cornerColors.bottomLeft, 'md', 'left')}
          </div>

          <div className="w-[min(74vw,calc(100dvh-100px),620px)] aspect-square shrink-0">
            <Board
              gameState={displayGameState}
              onTokenClick={handleTokenMove}
              canInteract={canUserInteractWithBoard}
              activeColor={displayPlayer.color}
              animatingToken={animatingToken}
              rotationDeg={boardRotationDeg}
            />
          </div>

          <div className="flex flex-col justify-between py-2 shrink-0">
            {renderDiceSlot(cornerColors.topRight, 'md', 'right')}
            {renderDiceSlot(cornerColors.bottomRight, 'md', 'right')}
          </div>
        </div>
      </div>

      {/* Room Disbanded Notification Modal (Online Modes) */}
      {displayGameState.status === 'disbanded' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-slate-900 border border-rose-500/40 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-rose-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display text-white">
                Room Disbanded
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {displayGameState.disbandReason ||
                  'All other players left the match. The room has been closed.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                (onReturnToOnlineMenu || onHome)();
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              Return to Online Menu ({disbandRedirectSec}s)
            </button>
          </div>
        </div>
      )}

      {/* Winner Modal (shown only after move/capture animations finish) */}
      {displayGameState.status === 'ended' && displayGameState.winner && !isAnimatingMove && (
        <WinnerModal
          gameState={displayGameState}
          onRematch={handleRestart}
          onHome={handleLeaveMatch}
        />
      )}

      {/* Pause Modal */}
      {isPaused && (
        <PauseModal
          onResume={() => setIsPaused(false)}
          onRestart={!isOnlineMode ? handleRestart : undefined}
          onHowToPlay={onHowToPlay}
          onLeave={handleLeaveMatch}
          canRestart={!isOnlineMode}
          isSoundMuted={isSoundMuted}
          onToggleSound={onToggleSound}
        />
      )}
    </div>
  );
};
