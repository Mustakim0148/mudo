/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Users, Plus, Loader2, AlertCircle } from 'lucide-react';
import { RoomState } from '../../types/ludo';
import { sounds } from '../../utils/soundEffects';
import { createFriendlyRoom } from '../../services/onlineMultiplayer';

interface CreateRoomScreenProps {
  onRoomCreated: (room: RoomState, playerId: string) => void;
  onBack: () => void;
  defaultPlayerName?: string;
  playerId?: string;
}

export const CreateRoomScreen: React.FC<CreateRoomScreenProps> = ({
  onRoomCreated,
  onBack,
  defaultPlayerName = 'Host Player',
  playerId,
}) => {
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(4);
  const [hostName, setHostName] = useState<string>(defaultPlayerName);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (isLoading) return;
    sounds.playClick();
    setIsLoading(true);
    setError(null);

    const activePlayerId =
      playerId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const fallbackGuest = `Player${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const data = await createFriendlyRoom({
        hostName: hostName.trim() || defaultPlayerName || fallbackGuest,
        maxPlayers,
        playerId: activePlayerId,
      });
      onRoomCreated(data.room, data.playerId);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create room. Please try again.'
      );
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
            Create Private Room
          </h1>
          <p className="text-xs text-slate-400">
            Host a room and invite your friends with a room code
          </p>
        </div>
      </div>

      {/* Host Name */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-2 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          Your Display Name
        </label>
        <input
          type="text"
          maxLength={18}
          value={hostName}
          onChange={e => setHostName(e.target.value)}
          placeholder="Enter host name"
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-amber-400 transition-colors"
        />
      </div>

      {/* Player Count Selection */}
      <div className="rounded-2xl p-5 bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
        <label className="text-sm font-semibold text-slate-200 block">
          How many players do you want in your room?
        </label>

        <div className="grid grid-cols-3 gap-3">
          {([2, 3, 4] as const).map(num => (
            <button
              key={num}
              type="button"
              onClick={() => {
                sounds.playClick();
                setMaxPlayers(num);
              }}
              className={`py-3.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                maxPlayers === num
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/20'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{num} Players</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 pt-1">
          The match will start automatically once exactly {maxPlayers} players enter this room.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-700/80 flex items-start gap-2.5 text-xs text-rose-200 shadow-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Create Button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleCreate}
        className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-400/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-base disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Creating Room...</span>
          </>
        ) : (
          <>
            <Plus className="w-5 h-5" />
            <span>Create Room</span>
          </>
        )}
      </button>
    </div>
  );
};
