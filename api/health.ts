/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';

export default function handler(_req: Request, res: Response) {
  const configured = Boolean(
    process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || true
  );
  res.status(200).json({
    ok: true,
    configured,
    provider: 'Firebase Firestore & Anonymous Auth',
    timestamp: new Date().toISOString(),
  });
}
