/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Firebase Firestore & Authentication Architecture Specification
 * 
 * MUDO is architected with dual multiplayer transport:
 * 1. Native High-Performance Node/Express Backend (enabled by default for immediate real-time multiplayer)
 * 2. Firebase Firestore & Auth integration provider
 */

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export function getFirebaseConfig(): FirebaseClientConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const appId = env.VITE_FIREBASE_APP_ID;

  if (projectId && apiKey && appId) {
    return {
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.appspot.com`,
      appId,
    };
  }
  return null;
}

export const isFirebaseConfigured = (): boolean => {
  return getFirebaseConfig() !== null;
};

/**
 * Firestore Blueprint Collections Structure for MUDO:
 * 
 * /mudo_rooms/{roomCode}
 *   - code: string
 *   - hostId: string
 *   - maxPlayers: number (2, 3, 4)
 *   - status: 'waiting' | 'in_game' | 'completed'
 *   - players: array of { id, name, color, isHost, isReady }
 *   - createdAt: timestamp
 * 
 * /mudo_games/{gameId}
 *   - gameId: string
 *   - mode: 'quick_match' | 'friendly'
 *   - players: array of Player
 *   - currentTurnIndex: number
 *   - diceValue: number
 *   - winners: array of PlayerColor
 *   - history: array of strings
 *   - updatedAt: timestamp
 * 
 * /mudo_matchmaking_queues/{queueId}
 *   - targetCount: 2 | 4
 *   - queuedPlayers: array of { playerId, playerName, timestamp }
 */

export const FIRESTORE_RULES_GUIDE = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /mudo_rooms/{roomCode} {
      allow read: if true;
      allow create, update: if request.auth != null || true;
    }
    match /mudo_games/{gameId} {
      allow read: if true;
      allow write: if request.auth != null || true;
    }
    match /mudo_matchmaking_queues/{queueId} {
      allow read, write: if true;
    }
  }
}
`;
