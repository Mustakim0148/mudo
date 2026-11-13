/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlayerColor } from '../../types/ludo';
import { Users, ArrowLeft, Play, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface OfflineSetupScreenProps {
  onStartOfflineGame: (playerCount: 2 | 3 | 4, playerNames: string[]) => void;
  onBack: () => void;
}

export const OfflineSetupScreen: React.FC<OfflineSetupScreenProps> = ({
  onStartOfflineGame,
  onBack,
}) => {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Player 1',
    'Player 2',
    'Player 3',
    'Player 4',
  ]);

  const colorsForCount: PlayerColor[] =
    playerCount === 2
      ? ['red', 'yellow']
      : playerCount === 3
      ? ['red', 'green', 'yellow']
      : ['red', 'green', 'yellow', 'blue'];

  const colorBgMap: Record<PlayerColor, string> = {
    red: 'bg-rose-500 text-white',
    green: 'bg-emerald-500 text-white',
    yellow: 'bg-amber-400 text-slate-950 font-bold',
    blue: 'bg-blue-500 text-white',
  };

  const handleNameChange = (idx: number, val: string) => {
    setPlayerNames(prev => prev.map((name, i) => (i === idx ? val : name)));
  };

  const handleStart = () => {
    sounds.playClick();
    onStartOfflineGame(playerCount, playerNames.slice(0, playerCount));
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Header with Back button */}
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
            Offline Pass &amp; Play
          </h1>
          <p className="text-xs text-slate-400">
            Share one screen with friends and family · No internet required
          </p>
        </div>
      </div>

      {/* Player Count Selector */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          Number of Players
        </label>
        <div className="grid grid-cols-3 gap-3">
          {([2, 3, 4] as const).map(num => (
            <button
              key={num}
              type="button"
              onClick={() => {
                sounds.playClick();
                setPlayerCount(num);
              }}
              className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                playerCount === num
                  ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-900/40 ring-1 ring-white/30'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{num} Players</span>
            </button>
          ))}
        </div>
      </div>

      {/* Player Names Customization */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          Player Names &amp; Colors
        </label>
        <div className="space-y-2.5">
          {colorsForCount.map((color, idx) => (
            <div
              key={color}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80"
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs uppercase font-bold shrink-0 ${colorBgMap[color]}`}
              >
                {color.charAt(0)}
              </span>
              <div className="flex-1">
                <input
                  type="text"
                  maxLength={18}
                  value={playerNames[idx]}
                  onChange={e => handleNameChange(idx, e.target.value)}
                  placeholder={`Player ${idx + 1}`}
                  className="w-full bg-transparent text-sm font-medium text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
              <span className="text-xs text-slate-400 capitalize pr-1 font-mono">
                {color}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl shadow-xl shadow-rose-900/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-base"
      >
        <Play className="w-5 h-5 fill-current" />
        Start Offline Match
      </button>
    </div>
  );
};
