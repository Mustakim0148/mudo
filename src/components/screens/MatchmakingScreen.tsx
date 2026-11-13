/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Users, CheckCircle2, X, Wifi, AlertCircle, RotateCcw } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';
import {
  enterMatchmakingQueue,
  leaveMatchmakingQueue,
  refreshMatchmakingHeartbeat,
  subscribeMatchmaking,
} from '../../services/onlineMultiplayer';

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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  const hasMatchedRef = useRef<boolean>(false);
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;

  // Search Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryKey]);

  // Real-Time Firebase Firestore Matchmaking
  useEffect(() => {
    if (!playerId) return;

    let isCancelled = false;
    let unsubscribeMatch: (() => void) | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    const triggerMatched = (gameId: string) => {
      if (hasMatchedRef.current || isCancelled) return;
      hasMatchedRef.current = true;
      setIsMatched(true);
      sounds.playWin();
      setTimeout(() => {
        if (!isCancelled) {
          onMatchFoundRef.current(gameId);
        }
      }, 900);
    };

    const startMatchmaking = async () => {
      setConnectionError(null);
      try {
        unsubscribeMatch = subscribeMatchmaking(playerId, targetCount, {
          onPlayersCount: count => {
            if (!isCancelled) {
              setPlayersFound(count);
            }
          },
          onMatched: gameId => {
            triggerMatched(gameId);
          },
          onError: () => {
            if (!isCancelled && !hasMatchedRef.current) {
              setConnectionError(
                'Connection failed. Please check your internet connection and try again.'
              );
            }
          },
        });

        const initialResult = await enterMatchmakingQueue(
          playerId,
          playerName,
          targetCount
        );
        if (isCancelled) return;

        setPlayersFound(Math.max(1, initialResult.playersFound));
        if (initialResult.status === 'matched' && initialResult.gameId) {
          triggerMatched(initialResult.gameId);
          return;
        }

        heartbeatTimer = setInterval(() => {
          if (!isCancelled && !hasMatchedRef.current) {
            void refreshMatchmakingHeartbeat(playerId, playerName);
          }
        }, 10_000);
      } catch {
        if (!isCancelled && !hasMatchedRef.current) {
          setConnectionError(
            'Unable to connect to matchmaking. Please check your connection and try again.'
          );
        }
      }
    };

    void startMatchmaking();

    return () => {
      isCancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubscribeMatch) unsubscribeMatch();
      if (!hasMatchedRef.current) {
        void leaveMatchmakingQueue(playerId);
      }
    };
  }, [playerId, playerName, targetCount, retryKey]);

  const handleCancel = () => {
    sounds.playClick();
    onCancel();
  };

  const handleRetry = () => {
    sounds.playClick();
    setSearchTime(0);
    setConnectionError(null);
    setRetryKey(k => k + 1);
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
        <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping opacity-75" />
        <div className="absolute inset-4 rounded-full border border-emerald-500/30 animate-pulse" />
        <div className="absolute inset-8 rounded-full border border-emerald-500/40" />

        <div
          className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ${
            isMatched
              ? 'bg-amber-400 text-slate-950 scale-110 shadow-amber-400/50'
              : connectionError
              ? 'bg-rose-600 text-white shadow-rose-600/40'
              : 'bg-emerald-600 text-white shadow-emerald-600/50'
          }`}
        >
          {isMatched ? (
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          ) : connectionError ? (
            <AlertCircle className="w-10 h-10" />
          ) : (
            <Loader2 className="w-10 h-10 animate-spin" />
          )}
        </div>
      </div>

      {/* Status Details */}
      <div className="space-y-3">
        <h2 className="text-2xl font-bold font-display text-white">
          {isMatched
            ? 'Match Found! Launching Board...'
            : connectionError
            ? 'Matchmaking Interrupted'
            : 'Searching for Players...'}
        </h2>

        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          {isMatched
            ? 'All players connected and ready. Initializing board colors.'
            : connectionError
            ? connectionError
            : `Looking for real players queueing for ${targetCount}-player format. Please wait while competitors join.`}
        </p>

        {/* Queue Progress Strip */}
        {!connectionError && (
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
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <Wifi className={`w-3.5 h-3.5 ${connectionError ? 'text-rose-400' : 'text-emerald-400'}`} />
        <span>
          {connectionError
            ? 'Matchmaking Connection Issue'
            : 'Firebase Real-Time Matchmaking Active'}
        </span>
      </div>

      {/* Action buttons */}
      {!isMatched && (
        <div className="pt-4 flex items-center justify-center gap-3">
          {connectionError && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Search
            </button>
          )}
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
