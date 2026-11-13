/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameMode = 'offline' | 'quick_match' | 'friendly' | 'ai';

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type PlayerType = 'human' | 'ai' | 'remote';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface TokenState {
  id: number; // 0..3
  color: PlayerColor;
  step: number; // -1 = yard, 0..50 = main track, 51..55 = home stretch, 56 = home
  isHome: boolean;
  isYard: boolean;
}

export type TurnPhase = 'roll' | 'move';

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  type: PlayerType;
  tokens: TokenState[];
  isWinner: boolean;
  hasLeft?: boolean;
  rank?: number;
  isHost?: boolean;
  isReady?: boolean;
}

export interface CapturedTokenInfo {
  playerId: string;
  color: PlayerColor;
  tokenId: number;
  fromStep: number;
}

export interface MoveAnimationData {
  moveId: string;
  playerId: string;
  color: PlayerColor;
  tokenId: number;
  fromStep: number;
  toStep: number;
  capturedTokens: CapturedTokenInfo[];
  reachedHome: boolean;
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  playerCount: 2 | 3 | 4;
  players: Player[];
  currentTurnIndex: number;
  diceValue: number | null;
  isRolling: boolean;
  hasRolled: boolean;
  validMoves: number[]; // indices of tokens for current player (0..3)
  consecutiveSixes: number;
  status: 'waiting' | 'playing' | 'ended' | 'disbanded';
  winners: PlayerColor[];
  winner: PlayerColor | null;
  lastAction: string;
  history: string[];
  aiDifficulty?: AIDifficulty;
  roomCode?: string;
  turnTimeout?: number;
  turnId?: string;
  currentPlayerId?: string;
  turnPhase?: TurnPhase;
  turnStartedAt?: number;
  diceDeadline?: number | null;
  tokenDeadline?: number | null;
  serverNow?: number;
  roomDisbanded?: boolean;
  disbandReason?: string | null;
  isAutoMoving?: boolean;
  lastMove?: MoveAnimationData | null;
  participantAuthUids?: string[];
}

export interface RoomParticipant {
  id: string;
  authUid?: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  isReady: boolean;
  connectedAt: number;
}

export interface RoomState {
  roomId?: string;
  code: string;
  hostId: string;
  hostAuthUid?: string;
  maxPlayers: 2 | 3 | 4;
  currentPlayerCount?: number;
  players: RoomParticipant[];
  assignedColors?: PlayerColor[];
  participantAuthUids?: string[];
  status: 'waiting' | 'in_game' | 'disbanded';
  gameId?: string | null;
  createdAt: number;
}

export interface MatchmakingQueueEntry {
  playerId: string;
  authUid?: string;
  playerName: string;
  targetCount: 2 | 4;
  status?: 'waiting' | 'matched';
  gameId?: string | null;
  expiresAt?: number;
  queuedAt: number;
}

