/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Sparkles } from 'lucide-react';
import { GameState, PlayerColor } from '../../types/ludo';
import { sounds } from '../../utils/soundEffects';

interface WinnerModalProps {
  gameState: GameState;
  onRematch: () => void;
  onHome: () => void;
}

const WINNER_COLOR_MAP: Record<PlayerColor, {
  text: string;
  badge: string;
  glow: string;
}> = {
  red: {
    text: 'text-rose-400',
    badge: 'bg-rose-600 text-white',
    glow: 'rgba(244, 63, 94, 0.4)',
  },
  green: {
    text: 'text-emerald-400',
    badge: 'bg-emerald-600 text-white',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  yellow: {
    text: 'text-amber-300',
    badge: 'bg-amber-400 text-slate-950 font-bold',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  blue: {
    text: 'text-blue-400',
    badge: 'bg-blue-600 text-white',
    glow: 'rgba(59, 130, 246, 0.4)',
  },
};

export const WinnerModal: React.FC<WinnerModalProps> = ({
  gameState,
  onRematch,
  onHome,
}) => {
  const winnerPlayer = gameState.players.find(p => p.color === gameState.winner);
  const colorInfo = gameState.winner ? WINNER_COLOR_MAP[gameState.winner] : WINNER_COLOR_MAP.red;

  useEffect(() => {
    sounds.playWin();

    // Trigger celebratory confetti burst
    const end = Date.now() + 3 * 1000;
    const colors = ['#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#fbbf24'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-slate-900 to-[#0a1120] border-2 border-amber-400/50 shadow-[0_0_50px_rgba(251,191,36,0.25)] text-center space-y-6">
        {/* Glow backdrop */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Trophy Centerpiece */}
        <div className="relative w-20 h-20 mx-auto rounded-3xl bg-amber-400/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/30">
          <Trophy className="w-10 h-10 animate-bounce" />
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-300 animate-spin" />
        </div>

        {/* Winner Announcement */}
        <div className="space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
            Match Victory!
          </span>
          <h2 className="text-3xl font-black font-display text-white">
            {winnerPlayer ? winnerPlayer.name : 'Player'} Wins!
          </h2>
          <p className="text-xs text-slate-400">
            Successfully brought all 4 tokens home into the center medallion!
          </p>
        </div>

        {/* Podium Rank Breakdown */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
            Final Standings
          </span>
          <div className="space-y-1.5">
            {gameState.players
              .slice()
              .sort((a, b) => {
                if (a.rank && b.rank) return a.rank - b.rank;
                if (a.rank) return -1;
                if (b.rank) return 1;
                // Tokens home
                const aHome = a.tokens.filter(t => t.isHome).length;
                const bHome = b.tokens.filter(t => t.isHome).length;
                return bHome - aHome;
              })
              .map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-900/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 w-4">
                      #{idx + 1}
                    </span>
                    <span className="text-slate-200 font-semibold truncate max-w-[150px]">
                      {p.name}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">
                    {p.tokens.filter(t => t.isHome).length}/4 Home
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onRematch();
            }}
            className="py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Rematch
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onHome();
            }}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all border border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
