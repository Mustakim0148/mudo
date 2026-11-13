/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameState, PlayerColor, TokenState } from '../types/ludo';
import {
  getTokenCoord,
  SAFE_TRACK_INDICES,
  TRACK_COORDS,
  YARD_TOKEN_COORDS,
} from '../utils/ludoEngine';
import { Star } from 'lucide-react';

export interface AnimatingTokenInfo {
  color: PlayerColor;
  tokenId: number;
  mode: 'forward' | 'reverse';
  durationMs: number;
}

interface BoardProps {
  gameState: GameState;
  onTokenClick: (tokenIndex: number) => void;
  canInteract: boolean;
  activeColor: PlayerColor;
  animatingToken?: AnimatingTokenInfo | null;
  rotationDeg?: 0 | 90 | 180 | 270;
}

const COLOR_MAP: Record<PlayerColor, {
  bg: string;
  border: string;
  text: string;
  fill: string;
  gradient: string;
  ring: string;
  tokenGradient: string;
  tokenShadow: string;
}> = {
  red: {
    bg: 'bg-rose-600',
    border: 'border-rose-500',
    text: 'text-rose-500',
    fill: '#e11d48',
    gradient: 'from-rose-600 to-rose-700',
    ring: 'ring-rose-400',
    tokenGradient: 'from-rose-500 via-rose-600 to-red-800',
    tokenShadow: 'rgba(225, 29, 72, 0.6)',
  },
  green: {
    bg: 'bg-emerald-600',
    border: 'border-emerald-500',
    text: 'text-emerald-500',
    fill: '#059669',
    gradient: 'from-emerald-600 to-emerald-700',
    ring: 'ring-emerald-400',
    tokenGradient: 'from-emerald-400 via-emerald-600 to-teal-800',
    tokenShadow: 'rgba(5, 150, 105, 0.6)',
  },
  yellow: {
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-amber-400',
    fill: '#d97706',
    gradient: 'from-amber-500 to-amber-600',
    ring: 'ring-amber-300',
    tokenGradient: 'from-amber-300 via-amber-500 to-yellow-700',
    tokenShadow: 'rgba(217, 119, 6, 0.6)',
  },
  blue: {
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    text: 'text-blue-500',
    fill: '#2563eb',
    gradient: 'from-blue-600 to-blue-700',
    ring: 'ring-blue-400',
    tokenGradient: 'from-sky-400 via-blue-600 to-indigo-800',
    tokenShadow: 'rgba(37, 99, 235, 0.6)',
  },
};

export const Board: React.FC<BoardProps> = ({
  gameState,
  onTokenClick,
  canInteract,
  activeColor,
  animatingToken = null,
  rotationDeg = 0,
}) => {
  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isCurrentTurn = currentPlayer && currentPlayer.color === activeColor;

  // Collect all tokens on the board with their computed grid positions
  interface PlacedToken {
    token: TokenState;
    playerId: string;
    playerIndex: number;
    tokenIndex: number;
    col: number;
    row: number;
    isMovable: boolean;
  }

  const placedTokens: PlacedToken[] = [];
  gameState.players.forEach((player, pIdx) => {
    if (player.hasLeft) return;

    // CRITICAL: A token can ONLY be movable if it belongs to the CURRENT player whose turn it is!
    const isThisPlayerTurn = pIdx === gameState.currentTurnIndex;

    player.tokens.forEach((token, tIdx) => {
      const coord = getTokenCoord(token);
      const isMovable =
        isThisPlayerTurn &&
        isCurrentTurn &&
        canInteract &&
        gameState.hasRolled &&
        token.step < 56 &&
        gameState.validMoves.includes(tIdx);

      placedTokens.push({
        token,
        playerId: player.id,
        playerIndex: pIdx,
        tokenIndex: tIdx,
        col: coord.col,
        row: coord.row,
        isMovable,
      });
    });
  });

  // Group tokens by cell key to handle stacking offsets while keeping stable DOM keys
  const tokensByCell = new Map<string, PlacedToken[]>();
  placedTokens.forEach(pt => {
    const key = `${pt.col.toFixed(1)}_${pt.row.toFixed(1)}`;
    if (!tokensByCell.has(key)) {
      tokensByCell.set(key, []);
    }
    tokensByCell.get(key)!.push(pt);
  });

  const tokenStackInfo = new Map<string, { count: number; stackIdx: number }>();
  tokensByCell.forEach(tokensInCell => {
    const count = tokensInCell.length;
    tokensInCell.forEach((pt, stackIdx) => {
      tokenStackInfo.set(`${pt.playerId}_${pt.token.color}_${pt.token.id}`, {
        count,
        stackIdx,
      });
    });
  });

  // Helper to render Yard bases (clean colored home areas with centered inner podium)
  const renderYard = (color: PlayerColor, colStart: number, rowStart: number) => {
    const colorStyle = COLOR_MAP[color];
    const yardPlayer = gameState.players.find(p => p.color === color);
    const hasLeft = Boolean(yardPlayer?.hasLeft);
    const isThisYardActive = !hasLeft && currentPlayer && currentPlayer.color === color;

    return (
      <div
        className={`absolute rounded-2xl p-2 sm:p-2.5 flex items-center justify-center shadow-lg border-2 transition-all duration-300 ${
          hasLeft ? 'opacity-40 grayscale' : ''
        }`}
        style={{
          left: `${(colStart / 15) * 100}%`,
          top: `${(rowStart / 15) * 100}%`,
          width: `${(6 / 15) * 100}%`,
          height: `${(6 / 15) * 100}%`,
          backgroundColor: '#0c1527',
          borderColor: isThisYardActive ? '#fbbf24' : colorStyle.fill,
          boxShadow: isThisYardActive
            ? `inset 0 0 25px ${colorStyle.tokenShadow}, 0 0 18px rgba(251, 191, 36, 0.35)`
            : `inset 0 0 20px ${colorStyle.tokenShadow}`,
        }}
      >
        {/* Inner colored platform */}
        <div
          className={`w-full h-full rounded-xl flex items-center justify-center relative overflow-hidden bg-gradient-to-br ${colorStyle.gradient} shadow-inner`}
        >
          {/* Symmetrically centered dark podium framing the 4 token slots */}
          <div className="w-[72%] h-[72%] bg-slate-900/85 rounded-xl border border-white/15 shadow-lg" />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full select-none">
      {/* Outer Felt Gaming Border */}
      <div className="relative w-full aspect-square rounded-3xl p-2 sm:p-3 bg-gradient-to-b from-slate-900 via-[#0a1224] to-slate-950 border border-slate-700/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        {/* Inner Board Canvas (15x15) rotated to local player's perspective */}
        <div
          className="relative w-full h-full rounded-2xl overflow-hidden bg-[#070d19] border border-slate-800 transition-transform duration-300"
          style={rotationDeg !== 0 ? { transform: `rotate(${rotationDeg}deg)` } : undefined}
        >
          {/* Base 15x15 Track Cells Grid */}
          <div className="absolute inset-0 grid grid-cols-15 grid-rows-15">
            {Array.from({ length: 225 }).map((_, i) => {
              const col = i % 15;
              const row = Math.floor(i / 15);

              // Skip 6x6 corners and 3x3 center
              const isCorner =
                (col < 6 && row < 6) ||
                (col > 8 && row < 6) ||
                (col < 6 && row > 8) ||
                (col > 8 && row > 8);
              const isCenter = col >= 6 && col <= 8 && row >= 6 && row <= 8;

              if (isCorner || isCenter) {
                return <div key={i} className="w-full h-full" />;
              }

              // Check if safe track index
              const trackIdx = TRACK_COORDS.findIndex(
                c => c.col === col && c.row === row
              );
              const isSafe = trackIdx !== -1 && SAFE_TRACK_INDICES.has(trackIdx);

              // Check if colored start cell
              const isRedStart = col === 6 && row === 13;
              const isGreenStart = col === 1 && row === 6;
              const isYellowStart = col === 8 && row === 1;
              const isBlueStart = col === 13 && row === 8;

              // Check if private colored home path
              const isRedHome = col === 7 && row >= 9 && row <= 13;
              const isGreenHome = row === 7 && col >= 1 && col <= 5;
              const isYellowHome = col === 7 && row >= 1 && row <= 5;
              const isBlueHome = row === 7 && col >= 9 && col <= 13;

              let cellBg = 'bg-slate-900/70';
              let cellBorder = 'border-slate-800/80';
              let cellStarColor: string | null = null;

              if (isRedHome || isRedStart) {
                cellBg = 'bg-rose-600/40';
                cellBorder = 'border-rose-500/60';
              } else if (isGreenHome || isGreenStart) {
                cellBg = 'bg-emerald-600/40';
                cellBorder = 'border-emerald-500/60';
              } else if (isYellowHome || isYellowStart) {
                cellBg = 'bg-amber-500/40';
                cellBorder = 'border-amber-400/60';
              } else if (isBlueHome || isBlueStart) {
                cellBg = 'bg-blue-600/40';
                cellBorder = 'border-blue-500/60';
              }

              if (isSafe) {
                cellStarColor = isRedStart
                  ? '#f43f5e'
                  : isGreenStart
                  ? '#10b981'
                  : isYellowStart
                  ? '#f59e0b'
                  : isBlueStart
                  ? '#3b82f6'
                  : '#fbbf24';
              }

              return (
                <div
                  key={i}
                  className={`relative w-full h-full border ${cellBorder} ${cellBg} flex items-center justify-center transition-colors`}
                >
                  {isSafe && cellStarColor && (
                    <Star
                      className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 opacity-80"
                      style={{
                        color: cellStarColor,
                        fill: cellStarColor,
                        transform: rotationDeg !== 0 ? `rotate(${-rotationDeg}deg)` : undefined,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* The 4 Yards */}
          {renderYard('green', 0, 0)}
          {renderYard('yellow', 9, 0)}
          {renderYard('red', 0, 9)}
          {renderYard('blue', 9, 9)}

          {/* Circular Token Slots aligned to exact YARD_TOKEN_COORDS */}
          {(['green', 'yellow', 'red', 'blue'] as PlayerColor[]).map(color =>
            YARD_TOKEN_COORDS[color].map((coord, slotIdx) => (
              <div
                key={`slot_${color}_${slotIdx}`}
                className="absolute z-10 flex items-center justify-center pointer-events-none"
                style={{
                  left: `${(coord.col / 15) * 100}%`,
                  top: `${(coord.row / 15) * 100}%`,
                  width: `${(1 / 15) * 100}%`,
                  height: `${(1 / 15) * 100}%`,
                }}
              >
                <div className="w-[88%] h-[88%] rounded-full bg-slate-950/75 border-2 border-white/25 flex items-center justify-center shadow-inner">
                  <div
                    className="w-[42%] h-[42%] rounded-full opacity-35"
                    style={{ backgroundColor: COLOR_MAP[color].fill }}
                  />
                </div>
              </div>
            ))
          )}

          {/* Central Home Triangle (3x3 Center: cols 6..8, rows 6..8) */}
          <div
            className="absolute flex items-center justify-center border-2 border-slate-700/80 shadow-2xl overflow-hidden rounded-lg"
            style={{
              left: `${(6 / 15) * 100}%`,
              top: `${(6 / 15) * 100}%`,
              width: `${(3 / 15) * 100}%`,
              height: `${(3 / 15) * 100}%`,
              backgroundColor: '#0a1020',
            }}
          >
            {/* SVG 4 Interlocking Triangles */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Top: Yellow */}
              <polygon points="0,0 100,0 50,50" fill={COLOR_MAP.yellow.fill} opacity="0.85" />
              {/* Right: Blue */}
              <polygon points="100,0 100,100 50,50" fill={COLOR_MAP.blue.fill} opacity="0.85" />
              {/* Bottom: Red */}
              <polygon points="0,100 100,100 50,50" fill={COLOR_MAP.red.fill} opacity="0.85" />
              {/* Left: Green */}
              <polygon points="0,0 0,100 50,50" fill={COLOR_MAP.green.fill} opacity="0.85" />

              {/* Center Medallion (counter-rotated so MUDO stays upright) */}
              <g transform={rotationDeg !== 0 ? `rotate(${-rotationDeg} 50 50)` : undefined}>
                <circle cx="50" cy="50" r="16" fill="#060b17" stroke="#fbbf24" strokeWidth="2" />
                <text
                  x="50"
                  y="53"
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize="7.5"
                  fontWeight="900"
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="0.5"
                >
                  MUDO
                </text>
              </g>
            </svg>
          </div>

          {/* Render Tokens Layer with stable keys for smooth cell-by-cell transitions */}
          {placedTokens.map(pt => {
            const { token, playerId: pId, tokenIndex, col, row, isMovable } = pt;
            const colorInfo = COLOR_MAP[token.color];
            const stackMeta = tokenStackInfo.get(`${pId}_${token.color}_${token.id}`) || {
              count: 1,
              stackIdx: 0,
            };
            const { count, stackIdx } = stackMeta;

            const isAnimatingThis =
              animatingToken !== null &&
              animatingToken.color === token.color &&
              animatingToken.tokenId === token.id;

            // Offset multiple tokens on same cell
            let offsetX = 0;
            let offsetY = 0;
            if (count > 1 && !isAnimatingThis) {
              const angle = (stackIdx / count) * 2 * Math.PI;
              const radius = 6;
              offsetX = Math.cos(angle) * radius;
              offsetY = Math.sin(angle) * radius;
            }

            const cellPercentX = (col / 15) * 100;
            const cellPercentY = (row / 15) * 100;
            const cellSizePercent = (1 / 15) * 100;

            return (
              <div
                key={`token_${pId}_${token.color}_${token.id}`}
                onClick={() => {
                  if (isMovable && pt.playerIndex === gameState.currentTurnIndex) {
                    onTokenClick(tokenIndex);
                  }
                }}
                className={`absolute flex items-center justify-center transition-all ${
                  isAnimatingThis
                    ? 'z-50 pointer-events-none'
                    : isMovable
                    ? 'movable-token cursor-pointer z-40'
                    : 'z-30 pointer-events-none'
                }`}
                style={{
                  left: `${cellPercentX}%`,
                  top: `${cellPercentY}%`,
                  width: `${cellSizePercent}%`,
                  height: `${cellSizePercent}%`,
                  transform: `translate(${offsetX}px, ${offsetY}px)`,
                  transitionDuration: isAnimatingThis
                    ? `${Math.max(30, animatingToken.durationMs)}ms`
                    : '150ms',
                  transitionTimingFunction:
                    isAnimatingThis && animatingToken.mode === 'reverse'
                      ? 'linear'
                      : 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {/* Token Body (3D Pawn Pin) counter-rotated so badges and lift stay screen-upright */}
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={rotationDeg !== 0 ? { transform: `rotate(${-rotationDeg}deg)` } : undefined}
                >
                  <div
                    className={`relative w-[78%] h-[78%] rounded-full bg-gradient-to-br ${colorInfo.tokenGradient} border-2 border-white/80 shadow-md flex items-center justify-center transition-transform duration-150 ${
                      isAnimatingThis && animatingToken.mode === 'forward'
                        ? 'scale-120 -translate-y-0.5'
                        : isAnimatingThis && animatingToken.mode === 'reverse'
                        ? 'scale-105 opacity-95'
                        : isMovable
                        ? 'scale-110'
                        : ''
                    }`}
                    style={{
                      boxShadow: isAnimatingThis
                        ? `0 6px 14px rgba(0,0,0,0.75), 0 0 12px ${colorInfo.tokenShadow}`
                        : `0 4px 10px rgba(0,0,0,0.6), 0 0 8px ${colorInfo.tokenShadow}`,
                    }}
                  >
                    {/* Inner gloss ring */}
                    <div className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-sm" />

                    {/* Stack count badge for multiple pieces */}
                    {count > 1 && stackIdx === count - 1 && !isAnimatingThis && (
                      <span className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-amber-400 text-amber-300 text-[8px] font-bold px-1 rounded-full shadow">
                        {count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
