/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const context = String(body.context || 'unknown').slice(0, 64);
    const code = String(body.code || 'unknown').slice(0, 64);
    const message = String(body.message || '')
      .replace(/AIza[0-9A-Za-z\-_]+/g, '[REDACTED]')
      .replace(/-----BEGIN[\s\S]*?END[^-]*-----/g, '[REDACTED]')
      .slice(0, 240);

    const metadata =
      typeof body.metadata === 'object' && body.metadata !== null
        ? body.metadata
        : {};

    console.error('[MUDO_SERVER_LOG]', {
      context,
      code,
      message,
      metadata,
      at: new Date().toISOString(),
    });

    return res.status(200).json({ logged: true });
  } catch {
    return res.status(400).json({ logged: false });
  }
}
