/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, Users, Crown, ArrowLeft, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { RoomState } from '../../types/ludo';
import { sounds } from '../../utils/soundEffects';

interface LobbyScreenProps {
  initialRoom: RoomState;
  playerId: string;
  onGameReady: (gameId: string) => void;
  onLeaveRoom: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  initialRoom,
  playerId,
  onGameReady,
  onLeaveRoom,
}) => {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [copied, setCopied] = useState<boolean>(false);
  const [isMatchReady, setIsMatchReady] = useState<boolean>(false);

  const onGameReadyRef = useRef(onGameReady);
  onGameReadyRef.current = onGameReady;

  // Poll room updates from backend
  useEffect(() => {
    let isCancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${room.code}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled) return;

        setRoom(data.room);

        // Check if game is ready
        if (data.room.gameId && data.room.players.length === data.room.maxPlayers) {
          setIsMatchReady(true);
          sounds.playWin();
          clearInterval(interval);
          setTimeout(() => {
            if (!isCancelled) {
              onGameReadyRef.current(data.room.gameId);
            }
          }, 1500);
        }
      } catch {}
    }, 1200);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [room.code]);

  const handleCopyCode = async () => {
    sounds.playClick();
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleLeave = async () => {
    sounds.playClick();
    try {
      await fetch(`/api/rooms/${room.code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
    } catch {}
    onLeaveRoom();
  };

  const emptySlotsCount = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleLeave}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer flex items-center gap-2 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave Lobby
        </button>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Lobby Live</span>
        </div>
      </div>

      {/* Room Code Card */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-slate-900 to-[#0c1527] border border-amber-400/40 shadow-2xl text-center space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400/80 font-bold">
            Private Room Code
          </span>
          <div className="text-3xl sm:text-5xl font-black font-mono tracking-wider text-white py-1">
            {room.code}
          </div>
        </div>

        {/* Copy Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wide transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-900" />
                <span>Code Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Share this code with your friends so they can join via Friendly Mode &rarr; Join Room.
        </p>
      </div>

      {/* Players Progress Bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          Players: {room.players.length} / {room.maxPlayers}
        </span>
        <span className="text-xs font-mono text-slate-400">
          {isMatchReady
            ? 'Match Ready! Launching...'
            : `Waiting for ${emptySlotsCount} more player${emptySlotsCount > 1 ? 's' : ''}...`}
        </span>
      </div>

      {/* Player Slots Grid */}
      <div className="space-y-3">
        {/* Connected Players */}
        {room.players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase text-white shadow ${
                  player.color === 'red'
                    ? 'bg-rose-600'
                    : player.color === 'green'
                    ? 'bg-emerald-600'
                    : player.color === 'yellow'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-blue-600'
                }`}
              >
                {player.color.charAt(0)}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {player.name}
                  </span>
                  {player.id === playerId && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono font-semibold">
                      YOU
                    </span>
                  )}
                  {player.isHost && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded font-semibold">
                      <Crown className="w-3 h-3" /> Host
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 capitalize">
                  Color: {player.color}
                </span>
              </div>
            </div>

            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <UserCheck className="w-4 h-4" /> Ready
            </span>
          </div>
        ))}

        {/* Empty Pending Slots */}
        {Array.from({ length: emptySlotsCount }).map((_, idx) => (
          <div
            key={`empty_${idx}`}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-500"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              </div>
              <span className="text-xs font-medium italic">
                Waiting for player to join...
              </span>
            </div>
            <span className="text-xs font-mono text-slate-600">Open Slot</span>
          </div>
        ))}
      </div>

      {/* Match Ready Banner */}
      {isMatchReady && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/80 text-center space-y-1 shadow-lg animate-pulse">
          <div className="flex items-center justify-center gap-2 text-emerald-300 font-bold text-base">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Room Full! Match Initializing...</span>
          </div>
          <p className="text-xs text-emerald-400">
            Redirecting all players to the Ludo board...
          </p>
        </div>
      )}
    </div>
  );
};
