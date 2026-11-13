/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Player, PlayerColor } from '../types/ludo';
import { Bot, User, Trophy, Shield } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  isCurrentTurn: boolean;
  isSelf?: boolean;
}

const COLOR_ACCENTS: Record<PlayerColor, {
  border: string;
  glow: string;
  bg: string;
  badge: string;
}> = {
  red: {
    border: 'border-rose-500',
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
    bg: 'bg-rose-950/40',
    badge: 'bg-rose-500 text-white',
  },
  green: {
    border: 'border-emerald-500',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    bg: 'bg-emerald-950/40',
    badge: 'bg-emerald-500 text-white',
  },
  yellow: {
    border: 'border-amber-400',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    bg: 'bg-amber-950/40',
    badge: 'bg-amber-500 text-slate-950',
  },
  blue: {
    border: 'border-blue-500',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
    bg: 'bg-blue-950/40',
    badge: 'bg-blue-500 text-white',
  },
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isCurrentTurn,
  isSelf,
}) => {
  const accent = COLOR_ACCENTS[player.color];
  const homeCount = player.tokens.filter(t => t.isHome).length;
  const yardCount = player.tokens.filter(t => t.isYard).length;
  const trackCount = 4 - homeCount - yardCount;

  return (
    <div
      className={`relative rounded-xl p-2.5 sm:p-3 transition-all duration-300 border ${
        isCurrentTurn
          ? `${accent.border} ${accent.glow} ${accent.bg} scale-[1.02] ring-1 ring-white/20`
          : 'border-slate-800 bg-slate-900/60 opacity-90'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar Icon */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner ${accent.badge}`}
          >
            {player.type === 'ai' ? (
              <Bot className="w-4 h-4" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {player.name}
              </span>
              {isSelf && (
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded font-mono">
                  YOU
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 capitalize">
              <span>{player.color}</span>
              {player.isWinner && (
                <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                  <Trophy className="w-2.5 h-2.5" /> Rank #{player.rank || 1}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Token Progress Indicators */}
        <div className="flex items-center gap-1.5 text-right font-mono">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-400 uppercase">Home</span>
            <span className="text-xs font-bold text-amber-400">{homeCount}/4</span>
          </div>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-400 uppercase">Active</span>
            <span className="text-xs font-semibold text-slate-200">{trackCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
