/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Users, Globe2, ShieldCheck, ArrowRight } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface QuickMatchScreenProps {
  onStartMatchmaking: (targetCount: 2 | 4, playerName: string) => void;
  onBack: () => void;
  defaultPlayerName?: string;
}

export const QuickMatchScreen: React.FC<QuickMatchScreenProps> = ({
  onStartMatchmaking,
  onBack,
  defaultPlayerName = 'Player',
}) => {
  const [selectedCount, setSelectedCount] = useState<2 | 4>(2);
  const [playerName, setPlayerName] = useState<string>(defaultPlayerName);

  const handleSelectCount = (count: 2 | 4) => {
    sounds.playClick();
    setSelectedCount(count);
  };

  const handleStart = () => {
    sounds.playClick();
    const fallbackGuest = `Player${Math.floor(1000 + Math.random() * 9000)}`;
    onStartMatchmaking(
      selectedCount,
      playerName.trim() || defaultPlayerName || fallbackGuest
    );
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onBack();
          }}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display text-white">
            Online Quick Match
          </h1>
          <p className="text-xs text-slate-400">
            Real-time matchmaking · Matched only with compatible queue
          </p>
        </div>
      </div>

      {/* Player Display Name */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          Your Display Name
        </label>
        <input
          type="text"
          maxLength={18}
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* 2-Player or 4-Player Selector */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-200 block">
          Select Match Format
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 2 Players */}
          <div
            onClick={() => handleSelectCount(2)}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              selectedCount === 2
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-white/20'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                1 vs 1 Duel
              </span>
              <Users className="w-5 h-5 text-emerald-400" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">2 Players</h3>
              <p className="text-xs text-slate-400 mt-1">
                Fast-paced 1-on-1 battle across opposite sides of the board (Red vs Yellow).
              </p>
            </div>
          </div>

          {/* 4 Players */}
          <div
            onClick={() => handleSelectCount(4)}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              selectedCount === 4
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-white/20'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Classic 4P Battle
              </span>
              <Globe2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">4 Players</h3>
              <p className="text-xs text-slate-400 mt-1">
                All 4 colors active (Red, Green, Yellow, Blue). Intense multiplayer arena.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <p>
          MUDO matches you strictly with real players searching for the exact same player count and automatically assigns each player a unique color.
        </p>
      </div>

      {/* Enter Matchmaking Button */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-base"
      >
        <span>Find {selectedCount}-Player Match</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};
