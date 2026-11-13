/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, HelpCircle, Settings, Home } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface NavbarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  isSoundMuted: boolean;
  onToggleSound: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  isSoundMuted,
  onToggleSound,
}) => {
  return (
    <header className="w-full bg-[#060b17]/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8 transition-colors">
      {/* Zone 1: Official Logo & Brand */}
      <div
        onClick={() => {
          sounds.playClick();
          onNavigate('home');
        }}
        className="flex items-center gap-2.5 cursor-pointer group shrink-0"
      >
        <img
          src="/logo.png"
          alt="MUDO Official Logo"
          className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black tracking-tight font-display text-white group-hover:text-amber-400 transition-colors">
            MUDO
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400/90 font-bold px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
            BY MUBIX
          </span>
        </div>
      </div>

      {/* Zone 2: 4 Clean single-line navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onNavigate('home');
          }}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            currentScreen === 'home' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          <Home className="w-4 h-4" />
          Home
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onNavigate('how_to_play');
          }}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            currentScreen === 'how_to_play' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          How to Play
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onNavigate('settings');
          }}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            currentScreen === 'settings' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </nav>

      {/* Zone 3: 1 Primary action cluster with sound toggle */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onToggleSound();
          }}
          title={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
          className="p-2 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white hover:border-slate-500 transition-all active:scale-95 cursor-pointer shadow-sm"
          aria-label={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isSoundMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          )}
        </button>

        {currentScreen !== 'home' && currentScreen !== 'board' && (
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onNavigate('home');
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all cursor-pointer shadow whitespace-nowrap shrink-0"
          >
            Game Modes
          </button>
        )}
      </div>
    </header>
  );
};
