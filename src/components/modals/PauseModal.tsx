/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RotateCcw, Home, HelpCircle, X, Volume2, VolumeX } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface PauseModalProps {
  onResume: () => void;
  onRestart?: () => void;
  onHowToPlay: () => void;
  onLeave: () => void;
  canRestart: boolean;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onHowToPlay,
  onLeave,
  canRestart,
  isSoundMuted,
  onToggleSound,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl p-6 bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onResume();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display text-white">
            Game Paused
          </h2>
          <p className="text-xs text-slate-400">
            Take a breath or adjust your session
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onResume();
            }}
            className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Match
          </button>

          {canRestart && onRestart && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onRestart();
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all border border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Restart Match
            </button>
          )}

          {onToggleSound && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onToggleSound();
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all border border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSoundMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-400" />
                  Sound: Off
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  Sound: On
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onHowToPlay();
            }}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all border border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            Rules &amp; How to Play
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onLeave();
            }}
            className="w-full py-3 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-semibold text-sm transition-all border border-rose-800/80 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Leave Match to Home
          </button>
        </div>
      </div>
    </div>
  );
};
