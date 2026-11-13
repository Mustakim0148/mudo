/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerColor } from '../types/ludo';

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  canRoll: boolean;
  playerColor: PlayerColor;
  onRoll: () => void;
  size?: 'sm' | 'md' | 'lg';
  hideLabel?: boolean;
}

const COLOR_GLOW_CLASSES: Record<PlayerColor, string> = {
  red: 'border-rose-500 shadow-rose-900/50 hover:border-rose-400',
  green: 'border-emerald-500 shadow-emerald-900/50 hover:border-emerald-400',
  yellow: 'border-amber-400 shadow-amber-900/50 hover:border-amber-300',
  blue: 'border-blue-500 shadow-blue-900/50 hover:border-blue-400',
};

const COLOR_TEXT_CLASSES: Record<PlayerColor, string> = {
  red: 'text-rose-500',
  green: 'text-emerald-500',
  yellow: 'text-amber-400',
  blue: 'text-blue-500',
};

// 3x3 grid dot positions for numbers 1..6
const PIP_CONFIGS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const Dice: React.FC<DiceProps> = ({
  value,
  isRolling,
  canRoll,
  playerColor,
  onRoll,
  size = 'md',
  hideLabel = false,
}) => {
  const pips = value && PIP_CONFIGS[value] ? PIP_CONFIGS[value] : PIP_CONFIGS[1];

  const sizeClasses = {
    sm: 'w-12 h-12 rounded-xl p-1.5',
    md: 'w-16 h-16 rounded-2xl p-2.5',
    lg: 'w-20 h-20 rounded-2xl p-3',
  }[size];

  const pipSize = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }[size];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          if (canRoll && !isRolling) {
            onRoll();
          }
        }}
        disabled={!canRoll || isRolling}
        aria-label={`Dice showing ${value || 1}. ${canRoll ? 'Click to roll' : 'Waiting for turn'}`}
        className={`relative select-none transition-all duration-200 transform ${sizeClasses} ${
          canRoll && !isRolling
            ? `cursor-pointer active:scale-95 shadow-lg ${COLOR_GLOW_CLASSES[playerColor]} ring-2 ring-white/40 animate-pulse`
            : `cursor-default shadow-md ${COLOR_GLOW_CLASSES[playerColor]}`
        } ${
          isRolling ? 'dice-rolling ring-4 ring-amber-400' : ''
        } bg-gradient-to-br from-slate-100 via-white to-slate-200 border-2 text-slate-900 shadow-xl`}
        style={{
          boxShadow: canRoll
            ? `0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px ${
                playerColor === 'red'
                  ? 'rgba(244, 63, 94, 0.45)'
                  : playerColor === 'green'
                  ? 'rgba(16, 185, 129, 0.45)'
                  : playerColor === 'yellow'
                  ? 'rgba(245, 158, 11, 0.45)'
                  : 'rgba(59, 130, 246, 0.45)'
              }`
            : '0 6px 16px -4px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Subtle corner gloss highlight */}
        <div className="absolute top-1 left-1.5 w-3 h-1.5 bg-white/80 rounded-full blur-[0.5px] pointer-events-none" />

        {/* 3x3 Grid for Pips */}
        <div className="w-full h-full grid grid-cols-3 grid-rows-3 place-items-center">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(idx => {
            const hasPip = pips.includes(idx);
            return (
              <div key={idx} className="w-full h-full flex items-center justify-center">
                {hasPip && (
                  <span
                    className={`${pipSize} rounded-full shadow-inner ${
                      value === 6 ? 'bg-amber-500 shadow-amber-600/60' : 'bg-slate-900 shadow-slate-950/70'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </button>

      {/* Helper label */}
      {!hideLabel && (
        <span
          className={`text-xs font-semibold tracking-wide uppercase ${
            canRoll ? COLOR_TEXT_CLASSES[playerColor] : 'text-slate-400'
          }`}
        >
          {canRoll ? 'Tap to Roll' : value ? `Rolled ${value}` : 'Waiting'}
        </span>
      )}
    </div>
  );
};
