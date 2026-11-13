/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, PlusCircle, LogIn, Users } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface FriendlyHubScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onBack: () => void;
}

export const FriendlyHubScreen: React.FC<FriendlyHubScreenProps> = ({
  onCreateRoom,
  onJoinRoom,
  onBack,
}) => {
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
            Friendly Private Rooms
          </h1>
          <p className="text-xs text-slate-400">
            Play with your friends via private room codes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
        {/* Create Room Card */}
        <div
          onClick={() => {
            sounds.playClick();
            onCreateRoom();
          }}
          className="group p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/80 transition-all duration-300 shadow-xl cursor-pointer hover:bg-slate-900 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                Create Room
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Host a custom room for 2, 3, or 4 players. Share the unique room code with your friends.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-400 font-mono">
            HOST A MATCH &rarr;
          </span>
        </div>

        {/* Join Room Card */}
        <div
          onClick={() => {
            sounds.playClick();
            onJoinRoom();
          }}
          className="group p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/80 transition-all duration-300 shadow-xl cursor-pointer hover:bg-slate-900 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center">
              <LogIn className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                Join Room
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Got a room code from a friend? Enter the code (e.g. MUDO-8K29) to join their waiting room.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-400 font-mono">
            ENTER ROOM CODE &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
