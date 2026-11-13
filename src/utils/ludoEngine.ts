/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIDifficulty, CapturedTokenInfo, GameMode, GameState, Player, PlayerColor, PlayerType, TokenState } from '../types/ludo';

export interface GridCoord {
  col: number; // 0..14
  row: number; // 0..14
}

// 52-cell outer track coordinates around the 15x15 board
export const TRACK_COORDS: GridCoord[] = [
  // Red side up (0..4)
  { col: 6, row: 13 }, // 0: Red Start (Safe)
  { col: 6, row: 12 }, // 1
  { col: 6, row: 11 }, // 2
  { col: 6, row: 10 }, // 3
  { col: 6, row: 9 },  // 4
  // Turn left towards Green (5..10)
  { col: 5, row: 8 },  // 5
  { col: 4, row: 8 },  // 6
  { col: 3, row: 8 },  // 7
  { col: 2, row: 8 },  // 8: Star Safe
  { col: 1, row: 8 },  // 9
  { col: 0, row: 8 },  // 10
  // Turn up (11..12)
  { col: 0, row: 7 },  // 11
  { col: 0, row: 6 },  // 12
  // Turn right towards Green track (13..17)
  { col: 1, row: 6 },  // 13: Green Start (Safe)
  { col: 2, row: 6 },  // 14
  { col: 3, row: 6 },  // 15
  { col: 4, row: 6 },  // 16
  { col: 5, row: 6 },  // 17
  // Turn up towards Yellow (18..23)
  { col: 6, row: 5 },  // 18
  { col: 6, row: 4 },  // 19
  { col: 6, row: 3 },  // 20
  { col: 6, row: 2 },  // 21: Star Safe
  { col: 6, row: 1 },  // 22
  { col: 6, row: 0 },  // 23
  // Turn right (24..25)
  { col: 7, row: 0 },  // 24
  { col: 8, row: 0 },  // 25
  // Turn down towards Yellow track (26..30)
  { col: 8, row: 1 },  // 26: Yellow Start (Safe)
  { col: 8, row: 2 },  // 27
  { col: 8, row: 3 },  // 28
  { col: 8, row: 4 },  // 29
  { col: 8, row: 5 },  // 30
  // Turn right towards Blue (31..36)
  { col: 9, row: 6 },  // 31
  { col: 10, row: 6 }, // 32
  { col: 11, row: 6 }, // 33
  { col: 12, row: 6 }, // 34: Star Safe
  { col: 13, row: 6 }, // 35
  { col: 14, row: 6 }, // 36
  // Turn down (37..38)
  { col: 14, row: 7 }, // 37
  { col: 14, row: 8 }, // 38
  // Turn left towards Blue track (39..43)
  { col: 13, row: 8 }, // 39: Blue Start (Safe)
  { col: 12, row: 8 }, // 40
  { col: 11, row: 8 }, // 41
  { col: 10, row: 8 }, // 42
  { col: 9, row: 8 },  // 43
  // Turn down towards Red (44..49)
  { col: 8, row: 9 },  // 44
  { col: 8, row: 10 }, // 45
  { col: 8, row: 11 }, // 46
  { col: 8, row: 12 }, // 47: Star Safe
  { col: 8, row: 13 }, // 48
  { col: 8, row: 14 }, // 49
  // Turn left back to start (50..51)
  { col: 7, row: 14 }, // 50
  { col: 6, row: 14 }, // 51
];

// Color start indices on the 52-cell TRACK_COORDS
export const COLOR_START_INDICES: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Safe track indices where tokens cannot be captured
export const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Private home paths for each color (steps 51..55)
export const HOME_PATHS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { col: 7, row: 13 }, // 51
    { col: 7, row: 12 }, // 52
    { col: 7, row: 11 }, // 53
    { col: 7, row: 10 }, // 54
    { col: 7, row: 9 },  // 55
  ],
  green: [
    { col: 1, row: 7 },  // 51
    { col: 2, row: 7 },  // 52
    { col: 3, row: 7 },  // 53
    { col: 4, row: 7 },  // 54
    { col: 5, row: 7 },  // 55
  ],
  yellow: [
    { col: 7, row: 1 },  // 51
    { col: 7, row: 2 },  // 52
    { col: 7, row: 3 },  // 53
    { col: 7, row: 4 },  // 54
    { col: 7, row: 5 },  // 55
  ],
  blue: [
    { col: 13, row: 7 }, // 51
    { col: 12, row: 7 }, // 52
    { col: 11, row: 7 }, // 53
    { col: 10, row: 7 }, // 54
    { col: 9, row: 7 },  // 55
  ],
};

// Central home triangles coordinates
export const CENTER_COORDS: Record<PlayerColor, GridCoord> = {
  red: { col: 7, row: 8 },
  green: { col: 6, row: 7 },
  yellow: { col: 7, row: 6 },
  blue: { col: 8, row: 7 },
};

// Starting Yard token coordinates (relative to 15x15 board)
export const YARD_TOKEN_COORDS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { col: 1.5, row: 10.5 },
    { col: 3.5, row: 10.5 },
    { col: 1.5, row: 12.5 },
    { col: 3.5, row: 12.5 },
  ],
  green: [
    { col: 1.5, row: 1.5 },
    { col: 3.5, row: 1.5 },
    { col: 1.5, row: 3.5 },
    { col: 3.5, row: 3.5 },
  ],
  yellow: [
    { col: 10.5, row: 1.5 },
    { col: 12.5, row: 1.5 },
    { col: 10.5, row: 3.5 },
    { col: 12.5, row: 3.5 },
  ],
  blue: [
    { col: 10.5, row: 10.5 },
    { col: 12.5, row: 10.5 },
    { col: 10.5, row: 12.5 },
    { col: 12.5, row: 12.5 },
  ],
};

// Computes the visual (col, row) on the 15x15 grid for a token
export function getTokenCoord(token: TokenState): GridCoord {
  if (token.step === -1) {
    return YARD_TOKEN_COORDS[token.color][token.id];
  }
  if (token.step >= 0 && token.step <= 50) {
    const trackIdx = (COLOR_START_INDICES[token.color] + token.step) % 52;
    return TRACK_COORDS[trackIdx];
  }
  if (token.step >= 51 && token.step <= 55) {
    const homeStepIdx = token.step - 51;
    return HOME_PATHS[token.color][homeStepIdx];
  }
  // Reached Center Home
  return CENTER_COORDS[token.color];
}

// Converts a token's step to absolute track index on the 52-cell board (if on common track)
export function getTrackIndex(color: PlayerColor, step: number): number | null {
  if (step >= 0 && step <= 50) {
    return (COLOR_START_INDICES[color] + step) % 52;
  }
  return null;
}

// Returns visual rotation angle (degrees clockwise) so `localColor` sits at Bottom-Left
export function getBoardRotationDeg(localColor: PlayerColor): 0 | 90 | 180 | 270 {
  switch (localColor) {
    case 'red':
      return 0;
    case 'blue':
      return 90;
    case 'yellow':
      return 180;
    case 'green':
      return 270;
  }
}

// Returns which PlayerColor sits at each visual screen corner for a given local perspective color
export function getRotatedCornerColors(localColor: PlayerColor): {
  topLeft: PlayerColor;
  topRight: PlayerColor;
  bottomLeft: PlayerColor;
  bottomRight: PlayerColor;
} {
  switch (localColor) {
    case 'red':
      return { topLeft: 'green', topRight: 'yellow', bottomLeft: 'red', bottomRight: 'blue' };
    case 'green':
      return { topLeft: 'yellow', topRight: 'blue', bottomLeft: 'green', bottomRight: 'red' };
    case 'yellow':
      return { topLeft: 'blue', topRight: 'red', bottomLeft: 'yellow', bottomRight: 'green' };
    case 'blue':
      return { topLeft: 'red', topRight: 'green', bottomLeft: 'blue', bottomRight: 'yellow' };
  }
}

// Initialize a fresh token
export function createToken(id: number, color: PlayerColor): TokenState {
  return {
    id,
    color,
    step: -1,
    isHome: false,
    isYard: true,
  };
}

// Initialize players for a match
export function createInitialPlayers(
  mode: GameMode,
  count: 2 | 3 | 4,
  humanColor: PlayerColor = 'red',
  playerNames?: string[],
  aiDifficulty: AIDifficulty = 'medium'
): Player[] {
  let colors: PlayerColor[] = [];
  if (count === 2) {
    // Standard 2P Ludo uses opposite sides: Red & Yellow
    colors = ['red', 'yellow'];
  } else if (count === 3) {
    colors = ['red', 'green', 'yellow'];
  } else {
    colors = ['red', 'green', 'yellow', 'blue'];
  }

  return colors.map((color, idx) => {
    let type: PlayerType = 'human';
    let name = playerNames?.[idx] || `Player ${idx + 1}`;

    if (mode === 'ai') {
      if (color === humanColor) {
        type = 'human';
        name = playerNames?.[0] || 'You';
      } else {
        type = 'ai';
        name = `AI ${color.toUpperCase()} (${aiDifficulty})`;
      }
    } else if (mode === 'offline') {
      type = 'human';
      name = playerNames?.[idx] || `${color.charAt(0).toUpperCase() + color.slice(1)} Player`;
    } else {
      // Remote / online
      type = idx === 0 ? 'human' : 'remote';
    }

    return {
      id: `p_${color}_${idx}`,
      name,
      color,
      type,
      tokens: [
        createToken(0, color),
        createToken(1, color),
        createToken(2, color),
        createToken(3, color),
      ],
      isWinner: false,
    };
  });
}

// Create fresh initial game state
export function createInitialGameState(
  mode: GameMode,
  playerCount: 2 | 3 | 4,
  options?: {
    humanColor?: PlayerColor;
    playerNames?: string[];
    aiDifficulty?: AIDifficulty;
    gameId?: string;
    roomCode?: string;
  }
): GameState {
  const players = createInitialPlayers(
    mode,
    playerCount,
    options?.humanColor || 'red',
    options?.playerNames,
    options?.aiDifficulty || 'medium'
  );

  return {
    gameId: options?.gameId || `mudo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    mode,
    playerCount,
    players,
    currentTurnIndex: 0,
    diceValue: null,
    isRolling: false,
    hasRolled: false,
    validMoves: [],
    consecutiveSixes: 0,
    status: 'playing',
    winners: [],
    winner: null,
    lastAction: `Match started! ${players[0].name}'s turn to roll.`,
    history: [`Match started in ${mode.toUpperCase()} mode with ${playerCount} players.`],
    aiDifficulty: options?.aiDifficulty || 'medium',
    roomCode: options?.roomCode,
  };
}

// Calculate valid moves for current player given a dice roll
export function getValidMoves(player: Player, dice: number): number[] {
  const validIndices: number[] = [];

  player.tokens.forEach((token, idx) => {
    // 1. If in yard, needs a 6 to enter step 0
    if (token.step === -1) {
      if (dice === 6) {
        validIndices.push(idx);
      }
      return;
    }

    // 2. If already reached center Home (step 56), cannot move
    if (token.step >= 56) {
      return;
    }

    // 3. Target step calculation
    const targetStep = token.step + dice;

    // Must finish at exactly 56 to enter home
    if (targetStep <= 56) {
      validIndices.push(idx);
    }
  });

  return validIndices;
}

// Result of executing a move
export interface MoveResult {
  updatedState: GameState;
  capturedOpponent: { color: PlayerColor; tokenId: number } | null;
  reachedHome: boolean;
  extraTurn: boolean;
  winnerColor: PlayerColor | null;
}

// Executes a token move in an authoritative, pure manner
export function executeMove(
  state: GameState,
  tokenIndex: number
): MoveResult {
  const { currentTurnIndex, diceValue, players } = state;
  if (diceValue === null) {
    throw new Error('Cannot execute move without rolling dice first');
  }

  const currentPlayer = players[currentTurnIndex];
  const token = currentPlayer.tokens[tokenIndex];
  const fromStep = token.step;
  const toStep = fromStep === -1 ? 0 : fromStep + diceValue;

  let capturedOpponent: { color: PlayerColor; tokenId: number } | null = null;
  const capturedTokens: CapturedTokenInfo[] = [];
  let reachedHome = false;
  let extraTurn = false;

  // Clone players to ensure immutability
  const nextPlayers = players.map((p, pIdx) => {
    if (pIdx !== currentTurnIndex) {
      return {
        ...p,
        tokens: p.tokens.map(t => ({ ...t })),
      };
    }

    // Current player's tokens
    const nextTokens = p.tokens.map((t, tIdx) => {
      if (tIdx !== tokenIndex) return { ...t };

      const nextStep = toStep;
      const isHome = nextStep >= 56;
      if (isHome) {
        reachedHome = true;
      }

      return {
        ...t,
        step: nextStep,
        isHome,
        isYard: nextStep === -1,
      };
    });

    return {
      ...p,
      tokens: nextTokens,
    };
  });

  const updatedToken = nextPlayers[currentTurnIndex].tokens[tokenIndex];

  // Check for opponent capture on common track (0..50)
  if (updatedToken.step >= 0 && updatedToken.step <= 50) {
    const landingTrackIdx = (COLOR_START_INDICES[currentPlayer.color] + updatedToken.step) % 52;
    const isSafeSquare = SAFE_TRACK_INDICES.has(landingTrackIdx);

    if (!isSafeSquare) {
      // Look for opponent tokens occupying this track cell
      nextPlayers.forEach((otherPlayer, otherIdx) => {
        if (otherIdx === currentTurnIndex || otherPlayer.hasLeft) return;

        otherPlayer.tokens.forEach(otherToken => {
          if (otherToken.step >= 0 && otherToken.step <= 50) {
            const otherTrackIdx = (COLOR_START_INDICES[otherPlayer.color] + otherToken.step) % 52;
            if (otherTrackIdx === landingTrackIdx) {
              const capturedFromStep = otherToken.step;
              // Captured! Send back to yard
              otherToken.step = -1;
              otherToken.isYard = true;
              otherToken.isHome = false;
              capturedOpponent = { color: otherPlayer.color, tokenId: otherToken.id };
              capturedTokens.push({
                playerId: otherPlayer.id,
                color: otherPlayer.color,
                tokenId: otherToken.id,
                fromStep: capturedFromStep,
              });
            }
          }
        });
      });
    }
  }

  // Extra roll awarded for:
  // 1. Rolling a 6 (unless consecutive sixes exceed threshold)
  // 2. Capturing an opponent's token
  // 3. Moving a token into Home
  if (diceValue === 6 || capturedOpponent || reachedHome) {
    extraTurn = true;
  }

  // Check if current player just won (all 4 tokens home)
  const allHome = nextPlayers[currentTurnIndex].tokens.every(t => t.step >= 56);
  let winnerColor: PlayerColor | null = null;
  const nextWinners = [...state.winners];

  if (allHome && !nextPlayers[currentTurnIndex].isWinner) {
    nextPlayers[currentTurnIndex].isWinner = true;
    nextPlayers[currentTurnIndex].rank = nextWinners.length + 1;
    nextWinners.push(currentPlayer.color);
    if (!state.winner) {
      winnerColor = currentPlayer.color;
    }
  }

  // Calculate next turn index
  let nextTurnIndex = currentTurnIndex;
  if (!extraTurn || allHome) {
    // Advance to next active player who hasn't already won or left
    let foundNext = false;
    for (let i = 1; i <= state.players.length; i++) {
      const candidateIdx = (currentTurnIndex + i) % state.players.length;
      if (!nextPlayers[candidateIdx].isWinner && !nextPlayers[candidateIdx].hasLeft) {
        nextTurnIndex = candidateIdx;
        foundNext = true;
        break;
      }
    }
    if (!foundNext) {
      nextTurnIndex = currentTurnIndex;
    }
  }

  // Check if game is complete (only 1 active non-left player remaining or all done)
  const remainingPlayers = nextPlayers.filter(p => !p.isWinner && !p.hasLeft);
  const isGameOver = remainingPlayers.length <= 1;

  let actionMsg = `${currentPlayer.name} moved a ${currentPlayer.color} token.`;
  if (capturedOpponent) {
    const opp = capturedOpponent as { color: PlayerColor; tokenId: number };
    actionMsg = `⚔️ ${currentPlayer.name} captured a ${opp.color} token and earned an extra roll!`;
  } else if (reachedHome) {
    actionMsg = `🎉 ${currentPlayer.name} brought a token HOME and earned an extra roll!`;
  } else if (extraTurn) {
    actionMsg = `🎲 ${currentPlayer.name} rolled a 6 and earned an extra roll!`;
  }

  const updatedState: GameState = {
    ...state,
    players: nextPlayers,
    currentTurnIndex: nextTurnIndex,
    diceValue: null,
    hasRolled: false,
    validMoves: [],
    consecutiveSixes: extraTurn && diceValue === 6 ? state.consecutiveSixes : 0,
    status: isGameOver ? 'ended' : 'playing',
    winners: nextWinners,
    winner: winnerColor || state.winner,
    lastAction: actionMsg,
    history: [actionMsg, ...state.history.slice(0, 19)],
    lastMove: {
      moveId: `mv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playerId: currentPlayer.id,
      color: currentPlayer.color,
      tokenId: token.id,
      fromStep,
      toStep,
      capturedTokens,
      reachedHome,
    },
  };

  return {
    updatedState,
    capturedOpponent,
    reachedHome,
    extraTurn,
    winnerColor,
  };
}

// AI decision logic: evaluates best token index to move
export function selectBestAIMove(
  state: GameState,
  validMoveIndices: number[],
  difficulty: AIDifficulty = 'medium'
): number {
  if (validMoveIndices.length === 0) return 0;
  if (validMoveIndices.length === 1) return validMoveIndices[0];

  const currentPlayer = state.players[state.currentTurnIndex];
  const dice = state.diceValue || 1;

  if (difficulty === 'easy') {
    // 70% random, 30% first valid
    return validMoveIndices[Math.floor(Math.random() * validMoveIndices.length)];
  }

  // Medium and Hard evaluate tactical score for each candidate token
  let bestIdx = validMoveIndices[0];
  let highestScore = -Infinity;

  for (const tokenIdx of validMoveIndices) {
    const token = currentPlayer.tokens[tokenIdx];
    let score = 0;

    // 1. Moving out of Yard
    if (token.step === -1 && dice === 6) {
      score += difficulty === 'hard' ? 45 : 30;
    }

    // 2. Finishing into Home
    if (token.step + dice === 56) {
      score += difficulty === 'hard' ? 90 : 70;
    }

    // 3. Entering home stretch (safe from captures)
    if (token.step <= 50 && token.step + dice > 50) {
      score += difficulty === 'hard' ? 55 : 40;
    }

    // Check target cell on common track
    const targetStep = token.step === -1 ? 0 : token.step + dice;
    if (targetStep >= 0 && targetStep <= 50) {
      const targetTrackIdx = (COLOR_START_INDICES[currentPlayer.color] + targetStep) % 52;
      const isTargetSafe = SAFE_TRACK_INDICES.has(targetTrackIdx);

      // 4. Capturing opponent
      if (!isTargetSafe) {
        state.players.forEach((otherP, pIdx) => {
          if (pIdx === state.currentTurnIndex) return;
          otherP.tokens.forEach(otherT => {
            if (otherT.step >= 0 && otherT.step <= 50) {
              const otherTrackIdx = (COLOR_START_INDICES[otherP.color] + otherT.step) % 52;
              if (otherTrackIdx === targetTrackIdx) {
                // High capture reward!
                score += difficulty === 'hard' ? 120 : 80;
              }
            }
          });
        });
      }

      // 5. Landing on Safe Star square
      if (isTargetSafe) {
        score += difficulty === 'hard' ? 35 : 20;
      }

      // 6. Hard AI calculates threat distance behind token
      if (difficulty === 'hard' && !isTargetSafe) {
        let isThreatened = false;
        state.players.forEach((otherP, pIdx) => {
          if (pIdx === state.currentTurnIndex) return;
          otherP.tokens.forEach(otherT => {
            if (otherT.step >= 0 && otherT.step <= 50) {
              const otherTrack = (COLOR_START_INDICES[otherP.color] + otherT.step) % 52;
              const distBehind = (targetTrackIdx - otherTrack + 52) % 52;
              if (distBehind >= 1 && distBehind <= 6) {
                isThreatened = true;
              }
            }
          });
        });

        if (isThreatened) {
          score -= 30; // penalize landing in immediate danger zone
        }

        // Check if currently threatened in current square, rewarding escape!
        if (token.step >= 0 && token.step <= 50) {
          const currentTrack = (COLOR_START_INDICES[currentPlayer.color] + token.step) % 52;
          let wasThreatened = false;
          state.players.forEach((otherP, pIdx) => {
            if (pIdx === state.currentTurnIndex) return;
            otherP.tokens.forEach(otherT => {
              if (otherT.step >= 0 && otherT.step <= 50) {
                const otherTrack = (COLOR_START_INDICES[otherP.color] + otherT.step) % 52;
                const dist = (currentTrack - otherTrack + 52) % 52;
                if (dist >= 1 && dist <= 6) {
                  wasThreatened = true;
                }
              }
            });
          });
          if (wasThreatened) {
            score += 40; // Escape reward!
          }
        }
      }
    }

    // General progress advancement
    score += targetStep * 0.5;

    // Small random tie-breaker
    score += Math.random() * 2;

    if (score > highestScore) {
      highestScore = score;
      bestIdx = tokenIdx;
    }
  }

  return bestIdx;
}
