/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, LogIn, Clipboard, Loader2, AlertTriangle } from 'lucide-react';
import { RoomState } from '../../types/ludo';
import { sounds } from '../../utils/soundEffects';
import {
  joinFriendlyRoom,
  normalizeAndValidateRoomCode,
  ROOM_JOIN_MESSAGES,
  RoomJoinError,
} from '../../services/onlineMultiplayer';

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
        setErrorMessage(null);
      }
    } catch {}
  };

  const handleJoin = async () => {
    if (isLoading) return;

    let normalizedCode: string;
    try {
      normalizedCode = normalizeAndValidateRoomCode(roomCode);
    } catch (err) {
      setErrorMessage(
        err instanceof RoomJoinError
          ? err.message
          : ROOM_JOIN_MESSAGES.INVALID_CODE
      );
      return;
    }

    setRoomCode(normalizedCode);
    sounds.playClick();
    setIsLoading(true);
    setErrorMessage(null);

    const activePlayerId =
      playerId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const fallbackGuest = `Player${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const data = await joinFriendlyRoom({
        roomCode: normalizedCode,
        playerName: playerName.trim() || defaultPlayerName || fallbackGuest,
        playerId: activePlayerId,
      });

      onRoomJoined(data.room, data.playerId);
    } catch (err: unknown) {
      if (err instanceof RoomJoinError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(ROOM_JOIN_MESSAGES.CONNECTION_ERROR);
      }
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
              maxLength={18}
              value={roomCode}
              onChange={e => {
                setRoomCode(e.target.value.toUpperCase());
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  void handleJoin();
                }
              }}
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

        {/* Attractive MUDO Notification Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 to-slate-900 border border-rose-500/50 shadow-lg shadow-rose-950/40 flex items-start gap-3 animate-fadeIn"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Unable to Join Room
              </p>
              <p className="text-sm text-rose-100 font-medium leading-snug">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={handleJoin}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-base disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Validating Room Code...</span>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>Connect to Room</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
