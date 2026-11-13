/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, LogIn, Clipboard, Loader2, AlertCircle } from 'lucide-react';
import { RoomState } from '../../types/ludo';
import { sounds } from '../../utils/soundEffects';

interface JoinRoomScreenProps {
  onRoomJoined: (room: RoomState, playerId: string) => void;
  onBack: () => void;
  defaultPlayerName?: string;
  playerId?: string;
}

export const JoinRoomScreen: React.FC<JoinRoomScreenProps> = ({
  onRoomJoined,
  onBack,
  defaultPlayerName = 'Player',
  playerId,
}) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>(defaultPlayerName);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePaste = async () => {
    sounds.playClick();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomCode(text.trim().toUpperCase());
      }
    } catch {}
  };

  const handleJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter a valid room code.');
      return;
    }

    sounds.playClick();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: code,
          playerName: playerName.trim() || 'Player',
          playerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to join room. Please check the code.');
      }

      onRoomJoined(data.room, data.playerId);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error connecting to room');
    } finally {
      setIsLoading(false);
    }
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
            Join Friendly Room
          </h1>
          <p className="text-xs text-slate-400">
            Enter the code shared by your friend (e.g. MUDO-8K29)
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-2xl p-6 bg-slate-900/80 border border-slate-800 space-y-5 shadow-xl">
        {/* Player Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200 block">
            Your Display Name
          </label>
          <input
            type="text"
            maxLength={18}
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Room Code with Paste button */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200 block">
            Room Code
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              maxLength={12}
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. MUDO-8K29"
              className="w-full px-4 py-3 pr-24 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono font-bold tracking-wider placeholder-slate-600 focus:outline-none focus:border-blue-500 uppercase transition-colors"
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Paste
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={handleJoin}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-base disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          <span>Connect to Room</span>
        </button>
      </div>
    </div>
  );
};
