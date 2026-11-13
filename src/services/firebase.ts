/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export function getFirebaseConfig(): FirebaseClientConfig {
  const env =
    (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};

  const projectId = env.VITE_FIREBASE_PROJECT_ID || appletFirebaseConfig.projectId;
  const apiKey = env.VITE_FIREBASE_API_KEY || appletFirebaseConfig.apiKey;
  const appId = env.VITE_FIREBASE_APP_ID || appletFirebaseConfig.appId;
  const authDomain =
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    appletFirebaseConfig.authDomain ||
    `${projectId}.firebaseapp.com`;
  const storageBucket =
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    appletFirebaseConfig.storageBucket ||
    `${projectId}.firebasestorage.app`;
  const messagingSenderId =
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    appletFirebaseConfig.messagingSenderId ||
    '';
  const firestoreDatabaseId =
    env.VITE_FIREBASE_DATABASE_ID || appletFirebaseConfig.firestoreDatabaseId;

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    firestoreDatabaseId,
  };
}

export const isFirebaseConfigured = (): boolean => {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.projectId && cfg.apiKey && cfg.appId);
};

const firebaseConfig = getFirebaseConfig();

const app: FirebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });

export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

export function reportServerError(
  context: string,
  error: unknown,
  metadata?: Record<string, string | number | boolean | null | undefined>
) {
  try {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : 'unknown';
    const message =
      error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);

    void fetch('/api/error-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        code,
        message,
        metadata: metadata || {},
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Non-blocking error telemetry
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  reportServerError(`firestore_${operationType}`, error, { path: path || 'none' });
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connection on initial boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
      reportServerError('firestore_boot_offline', error);
    }
  }
}
void testConnection();

// Server clock offset calibration for cross-device 15s turn timer synchronization
let serverClockOffsetMs = 0;

export function getEstimatedServerNow(): number {
  return Date.now() + serverClockOffsetMs;
}

export function updateServerClockOffsetFromMillis(serverMillis: number) {
  if (Number.isFinite(serverMillis) && serverMillis > 0) {
    serverClockOffsetMs = serverMillis - Date.now();
  }
}

export async function syncServerClockOffset(uid: string): Promise<number> {
  try {
    const clockRef = doc(db, 'mudo_clock', uid);
    await setDoc(clockRef, { uid, t: serverTimestamp() });
    const snap = await getDocFromServer(clockRef);
    const data = snap.data();
    if (data && data.t instanceof Timestamp) {
      serverClockOffsetMs = data.t.toMillis() - Date.now();
    }
  } catch (err) {
    reportServerError('clock_sync', err);
  }
  return serverClockOffsetMs;
}

let pendingAnonymousSignIn: Promise<User> | null = null;

export async function ensureAnonymousAuth(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  if (!pendingAnonymousSignIn) {
    pendingAnonymousSignIn = signInAnonymously(auth)
      .then(async cred => {
        await syncServerClockOffset(cred.user.uid);
        return cred.user;
      })
      .finally(() => {
        pendingAnonymousSignIn = null;
      });
  }
  return pendingAnonymousSignIn;
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, user => {
    if (user) {
      void syncServerClockOffset(user.uid);
    }
    callback(user);
  });
}
