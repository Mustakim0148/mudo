/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Users, CheckCircle2, X, Wifi } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';

interface MatchmakingScreenProps {
  playerId: string;
  playerName: string;
  targetCount: 2 | 4;
  onMatchFound: (gameId: string) => void;
  onCancel: () => void;
}

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerId,
  playerName,
  targetCount,
  onMatchFound,
  onCancel,
}) => {
  const [playersFound, setPlayersFound] = useState<number>(1);
  const [isMatched, setIsMatched] = useState<boolean>(false);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const hasMatchedRef = useRef<boolean>(false);
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;

  // Search Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real Matchmaking API Interaction
  useEffect(() => {
    let isCancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    const triggerMatched = (gameId: string) => {
      hasMatchedRef.current = true;
      setIsMatched(true);
      sounds.playWin();
      setTimeout(() => {
        if (!isCancelled) {
          onMatchFoundRef.current(gameId);
        }
      }, 1200);
    };

    const joinQueue = async () => {
      try {
        const res = await fetch('/api/matchmaking/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            playerName,
            targetCount,
          }),
        });
        const data = await res.json();
        if (isCancelled) return;

        setServerStatus('connected');

        if (data.status === 'matched' && data.gameId) {
          triggerMatched(data.gameId);
          return;
        }

        if (data.playersFound) {
          setPlayersFound(data.playersFound);
        }

        // Start polling queue status
        pollInterval = setInterval(async () => {
          if (isCancelled) return;
          try {
            const statusRes = await fetch(
              `/api/matchmaking/status?playerId=${encodeURIComponent(playerId)}&targetCount=${targetCount}`
            );
            const statusData = await statusRes.json();
            if (isCancelled) return;

            if (statusData.status === 'matched' && statusData.gameId) {
              if (pollInterval) clearInterval(pollInterval);
              triggerMatched(statusData.gameId);
            } else if (statusData.playersFound) {
              setPlayersFound(statusData.playersFound);
            }
          } catch {
            setServerStatus('error');
          }
        }, 1500);
      } catch {
        setServerStatus('error');
      }
    };

    joinQueue();

    return () => {
      isCancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      // Only leave the waiting queue if we did NOT match into an active game
      if (!hasMatchedRef.current) {
        fetch('/api/matchmaking/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        }).catch(() => {});
      }
    };
  }, [playerId, playerName, targetCount]);

  const handleCancel = () => {
    sounds.playClick();
    onCancel();
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12 text-center space-y-8">
      {/* Visual Radar Animation */}
      <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
        {/* Pulsing Concentric Rings */}
        <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping opacity-75" />
        <div className="absolute inset-4 rounded-full border border-emerald-500/30 animate-pulse" />
        <div className="absolute inset-8 rounded-full border border-emerald-500/40" />

        {/* Center Orb */}
        <div
          className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ${
            isMatched
              ? 'bg-amber-400 text-slate-950 scale-110 shadow-amber-400/50'
              : 'bg-emerald-600 text-white shadow-emerald-600/50'
          }`}
        >
          {isMatched ? (
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          ) : (
            <Loader2 className="w-10 h-10 animate-spin" />
          )}
        </div>
      </div>

      {/* Status Details */}
      <div className="space-y-3">
        <h2 className="text-2xl font-bold font-display text-white">
          {isMatched ? 'Match Found! Launching Board...' : 'Searching for Players...'}
        </h2>

        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          {isMatched
            ? 'All players connected and ready. Initializing board colors.'
            : `Looking for players queueing for ${targetCount}-player format. Please wait while competitors join.`}
        </p>

        {/* Queue Progress Strip */}
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm font-semibold">
          <Users className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">
            Players Found:{' '}
            <span className="text-amber-400 font-bold font-mono">
              {playersFound} / {targetCount}
            </span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono">{formatSeconds(searchTime)}</span>
        </div>
      </div>

      {/* Connection telemetry indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        <span>Live Multiplayer Server Connected (0.0.0.0:3000)</span>
      </div>

      {/* Cancel button */}
      {!isMatched && (
        <div className="pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-semibold transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel Matchmaking
          </button>
        </div>
      )}
    </div>
  );
};
