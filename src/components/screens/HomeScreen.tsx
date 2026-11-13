/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, Globe2, UserPlus, Bot, Shield, Trophy, ArrowRight, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface HomeScreenProps {
  onSelectMode: (mode: 'offline' | 'quick_match' | 'friendly' | 'ai') => void;
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectMode,
  onNavigate,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">
      {/* Hero Showcase Centerpiece */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

        {/* Left Column: Brand Lockup & Value Proposition */}
        <div className="space-y-4 max-w-xl z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Premium Multiplayer Web Ludo</span>
            <span className="text-slate-500">·</span>
            <span>MUBIX Edition</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black font-display tracking-tight text-white leading-none">
            MUDO
          </h1>

          <p className="text-lg sm:text-xl font-medium text-amber-300/90 font-display">
            A Better Way to Play Ludo.
          </p>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-md">
            Experience traditional Ludo modernized for today: buttery 60fps animations, intelligent AI, real-time multiplayer lobbies, and 100% offline local pass-and-play.
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onSelectMode('quick_match');
              }}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-400/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              Play Now
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onNavigate('how_to_play');
              }}
              className="px-5 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              How to Play
            </button>
          </div>
        </div>

        {/* Right Column: Official MUDO Game Logo */}
        <div className="relative w-64 sm:w-80 md:w-96 shrink-0 z-10 flex items-center justify-center p-2">
          <div className="relative w-full flex items-center justify-center">
            {/* Ambient radial glow */}
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <img
              src="/logo.png"
              alt="MUDO Official Game Logo"
              className="relative z-10 w-full h-auto max-h-72 sm:max-h-80 object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>
      </div>

      {/* Game Modes Selection Grid (The 4 Modes) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
              Choose Game Mode
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Select your preferred way to play MUDO
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. Offline Mode */}
          <div
            onClick={() => {
              sounds.playClick();
              onSelectMode('offline');
            }}
            className="group relative rounded-2xl p-6 bg-slate-900/80 border border-slate-800 hover:border-rose-500/80 hover:bg-slate-900 transition-all duration-300 shadow-lg cursor-pointer hover:shadow-rose-950/30 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-rose-400 bg-rose-950/60 px-2.5 py-1 rounded-full border border-rose-800/40 font-semibold">
                  100% Offline
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-rose-400 transition-colors">
                  Offline Mode
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Pass-and-play with friends and family on a single device. Full standard Ludo rules without requiring internet.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-rose-400">
              <span>2, 3, or 4 Players</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Configure Match <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 2. Quick Match */}
          <div
            onClick={() => {
              sounds.playClick();
              onSelectMode('quick_match');
            }}
            className="group relative rounded-2xl p-6 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/80 hover:bg-slate-900 transition-all duration-300 shadow-lg cursor-pointer hover:shadow-emerald-950/30 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
                  <Globe2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/40 font-semibold">
                  Online Matchmaking
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Quick Match
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Real online matchmaking queue. Get paired with players searching for 2-player or 4-player competitive battles.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span>2 or 4 Players Queue</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Find Match <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 3. Friendly Mode */}
          <div
            onClick={() => {
              sounds.playClick();
              onSelectMode('friendly');
            }}
            className="group relative rounded-2xl p-6 bg-slate-900/80 border border-slate-800 hover:border-amber-400/80 hover:bg-slate-900 transition-all duration-300 shadow-lg cursor-pointer hover:shadow-amber-950/30 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-inner">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-800/40 font-semibold">
                  Private Rooms
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                  Friendly Mode
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Create a custom room with a unique room code or join a friend&apos;s lobby with random color assignment.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-amber-400">
              <span>Room Code System</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Lobby Hub <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 4. Human vs AI */}
          <div
            onClick={() => {
              sounds.playClick();
              onSelectMode('ai');
            }}
            className="group relative rounded-2xl p-6 bg-slate-900/80 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-900 transition-all duration-300 shadow-lg cursor-pointer hover:shadow-blue-950/30 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-inner">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800/40 font-semibold">
                  Smart Computer
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                  Human vs AI
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Hone your tactics against smart heuristic AI opponents. Choose from Easy, Medium, and Hard tactical challenges.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-blue-400">
              <span>Easy · Medium · Hard</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Start Solo <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branding & Copyright (MUBIX Identity) */}
      <footer className="pt-8 border-t border-slate-800/80 text-center space-y-2">
        <p className="text-sm font-semibold text-slate-300 font-display">
          Powered by <span className="text-amber-400 font-bold">MUBIX</span>
        </p>
        <p className="text-xs text-slate-500 font-mono">
          &copy; 2026 MUBIX. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};
