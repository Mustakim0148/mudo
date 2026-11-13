/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { ArrowLeft, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { ensureAnonymousAuth, reportServerError } from '../services/firebase';
import { sounds } from '../utils/soundEffects';

interface OnlineAuthGateProps {
  user: User | null;
  authReady: boolean;
  onBack: () => void;
  children: React.ReactNode;
}

export const OnlineAuthGate: React.FC<OnlineAuthGateProps> = ({
  user,
  authReady,
  onBack,
  children,
}) => {
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    if (!authReady || user) return;

    let cancelled = false;
    const connectAnonymously = async () => {
      setIsConnecting(true);
      setAuthError(null);
      try {
        await ensureAnonymousAuth();
      } catch (err: unknown) {
        if (cancelled) return;
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: unknown }).code)
            : '';
        reportServerError('anonymous_signin', err);

        if (
          code === 'auth/admin-restricted-operation' ||
          code === 'auth/operation-not-allowed'
        ) {
          setAuthError(
            'Anonymous sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Anonymous).'
          );
        } else if (code === 'auth/network-request-failed') {
          setAuthError(
            'Connection failed. Please check your internet connection and try again.'
          );
        } else {
          setAuthError('Unable to connect to online multiplayer. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsConnecting(false);
        }
      }
    };

    void connectAnonymously();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, retryCount]);

  if (user) {
    return <>{children}</>;
  }

  if (!authReady || isConnecting || !authError) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
        <p className="text-sm text-slate-400 font-medium">
          Connecting to MUDO Online Services...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8 space-y-6">
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
            Online Connection Issue
          </h1>
          <p className="text-xs text-slate-400">
            Unable to initialize online player session
          </p>
        </div>
      </div>

      <div className="rounded-3xl p-6 bg-slate-900/85 border border-slate-800 shadow-2xl space-y-5 text-center">
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-700/80 flex items-start gap-2.5 text-xs text-rose-200 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{authError}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            setRetryCount(c => c + 1);
          }}
          className="w-full py-3.5 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    </div>
  );
};
