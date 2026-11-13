/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Users, Bot, Play, Zap, ShieldAlert, Cpu } from 'lucide-react';
import { AIDifficulty, PlayerColor } from '../../types/ludo';
import { sounds } from '../../utils/soundEffects';

interface AISetupScreenProps {
  onStartAIGame: (
    playerCount: 2 | 3 | 4,
    humanColor: PlayerColor,
    difficulty: AIDifficulty,
    playerName: string
  ) => void;
  onBack: () => void;
  defaultPlayerName?: string;
}

export const AISetupScreen: React.FC<AISetupScreenProps> = ({
  onStartAIGame,
  onBack,
  defaultPlayerName = 'You',
}) => {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [humanColor, setHumanColor] = useState<PlayerColor>('red');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [playerName, setPlayerName] = useState<string>(defaultPlayerName);

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

  const handleStart = () => {
    sounds.playClick();
    onStartAIGame(playerCount, humanColor, difficulty, playerName.trim() || 'You');
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
            Human vs AI Solo Mode
          </h1>
          <p className="text-xs text-slate-400">
            Play against intelligent computer players with strategic heuristic reasoning
          </p>
        </div>
      </div>

      {/* Player Count */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
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
                // Ensure chosen color is valid for new count
                if (num === 2 && humanColor !== 'red' && humanColor !== 'yellow') {
                  setHumanColor('red');
                } else if (num === 3 && humanColor === 'blue') {
                  setHumanColor('red');
                }
              }}
              className={`py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                playerCount === num
                  ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40 ring-1 ring-white/30'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{num} Players</span>
            </button>
          ))}
        </div>
      </div>

      {/* Choose Your Color */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          Choose Your Color (You control 1 color, AI controls the rest)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {colorsForCount.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => {
                sounds.playClick();
                setHumanColor(color);
              }}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                humanColor === color
                  ? 'bg-slate-800 border-white ring-2 ring-amber-400 text-white font-bold'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="capitalize text-xs font-semibold">{color}</span>
              <span
                className={`w-4 h-4 rounded-full ${colorBgMap[color]} shadow-sm`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* AI Difficulty Selector */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          AI Difficulty Level
        </label>
        <div className="grid grid-cols-3 gap-3">
          {/* Easy */}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setDifficulty('easy');
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
              difficulty === 'easy'
                ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-400 text-white'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">Easy</span>
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] text-slate-400">Casual / Relaxed play</span>
          </button>

          {/* Medium */}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setDifficulty('medium');
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
              difficulty === 'medium'
                ? 'bg-amber-950/50 border-amber-500 ring-1 ring-amber-400 text-white'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">Medium</span>
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-[10px] text-slate-400">Captures &amp; advances</span>
          </button>

          {/* Hard */}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setDifficulty('hard');
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
              difficulty === 'hard'
                ? 'bg-rose-950/50 border-rose-500 ring-1 ring-rose-400 text-white'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400">Hard</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <span className="text-[10px] text-slate-400">Calculated tactics</span>
          </button>
        </div>
      </div>

      {/* Start Button */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-base"
      >
        <Bot className="w-5 h-5" />
        <span>Start AI Match ({difficulty.toUpperCase()})</span>
      </button>
    </div>
  );
};
