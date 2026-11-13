/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';
import { isFirebaseConfigured } from '../../services/firebase';

interface SettingsScreenProps {
  onBack: () => void;
  isSoundMuted: boolean;
  onToggleSound: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  isSoundMuted,
  onToggleSound,
}) => {
  const [volume, setVolume] = useState<number>(sounds.getVolume());

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    sounds.setVolume(newVol);
    sounds.playTokenStep();
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
            Game Settings
          </h1>
          <p className="text-xs text-slate-400">
            Audio preferences and online multiplayer controls
          </p>
        </div>
      </div>

      {/* Audio Settings */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-200">
          Audio &amp; Sound Effects
        </h2>

        {/* Master Mute Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 text-slate-300">
              {isSoundMuted ? (
                <VolumeX className="w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <span className="text-sm font-semibold text-white block">
                Sound Effects
              </span>
              <span className="text-xs text-slate-400">
                Dice tumble, token steps, captures &amp; fanfares
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleSound}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              isSoundMuted
                ? 'bg-rose-950/80 border border-rose-800 text-rose-300'
                : 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
            }`}
          >
            {isSoundMuted ? 'Muted' : 'Enabled'}
          </button>
        </div>

        {/* Volume Slider */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Effects Volume</span>
            <span className="font-mono text-amber-400">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            disabled={isSoundMuted}
            onChange={e => handleVolumeChange(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer disabled:opacity-40"
          />
        </div>
      </div>

      {/* Online Multiplayer Session */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Online Multiplayer Session
        </h2>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Real-Time Backend:</span>
            <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isFirebaseConfigured() ? 'Cloud Firestore Connected' : 'Offline Only'}
            </span>
          </div>
          <p className="text-slate-400">
            Online Quick Match and Friendly Rooms use seamless guest authentication—no account sign-in required.
          </p>
        </div>
      </div>

      {/* Copyright & Credits */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center space-y-1">
        <p className="text-xs font-semibold text-slate-300">
          MUDO &copy; 2026 MUBIX. All Rights Reserved.
        </p>
        <p className="text-[11px] text-slate-500 font-mono">
          A Better Way to Play Ludo · Engineered by MUBIX
        </p>
      </div>
    </div>
  );
};
