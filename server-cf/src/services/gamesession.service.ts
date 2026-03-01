/**
 * @fileoverview Game session service — issues and validates anti-cheat game sessions.
 *
 * Flow:
 *   1. Client calls POST /api/leaderboard/session at game start → gets
 *      { gameSessionToken, hmacKey } back.
 *   2. Client signs score payload with hmacKey during submission.
 *   3. Server verifies the session token (HMAC-signed, single-use, time-bound)
 *      and the score checksum using the per-session hmacKey.
 */

import * as GameSessionModel from '../models/gamesession.model';
import { timingSafeEqual } from './crypto.utils';

/** Max active (unused) game sessions per user — prevents abuse. */
const MAX_ACTIVE_SESSIONS = 5;

// ─── Token building / verification ─────────────────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function _hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(sig);
}

function _toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _fromBase64Url(b64: string): string {
  return atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * Build a game session token: `base64url(userId:nonce).hmacHex`
 */
async function buildToken(userId: string, nonce: string, secret: string): Promise<string> {
  const payload = `${userId}:${nonce}`;
  const sig = await _hmacSign(payload, secret);
  return `${_toBase64Url(payload)}.${sig}`;
}

/**
 * Parse and verify a game session token. Returns the nonce if valid, null otherwise.
 */
async function verifyToken(token: string, userId: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const b64Payload = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  let payload: string;
  try {
    payload = _fromBase64Url(b64Payload);
  } catch {
    return null;
  }

  const expectedPrefix = `${userId}:`;
  if (!payload.startsWith(expectedPrefix)) return null;

  const nonce = payload.slice(expectedPrefix.length);
  if (!nonce) return null;

  const expectedSig = await _hmacSign(payload, secret);
  if (!timingSafeEqual(expectedSig, sigHex)) return null;

  return nonce;
}

/**
 * Generate a random 32-byte hex key for per-session HMAC signing.
 */
function generateSessionHmacKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer as ArrayBuffer);
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface GameSessionResult {
  gameSessionToken: string;
  hmacKey: string;
}

/**
 * Create a new game session. Returns the token + per-session HMAC key.
 */
export async function createSession(
  db: D1Database,
  scoreHmacSecret: string,
  userId: string,
): Promise<GameSessionResult> {
  // Limit concurrent sessions to prevent abuse
  const activeCount = await GameSessionModel.countActiveSessions(db, userId);
  if (activeCount >= MAX_ACTIVE_SESSIONS) {
    throw new GameSessionError('Too many active game sessions. Finish or wait for expiry.', 429);
  }

  const nonce = crypto.randomUUID();
  const hmacKey = generateSessionHmacKey();
  const token = await buildToken(userId, nonce, scoreHmacSecret);

  await GameSessionModel.createGameSession(db, userId, nonce, hmacKey);

  // Opportunistic cleanup
  GameSessionModel.cleanExpiredSessions(db).catch(() => {});

  return { gameSessionToken: token, hmacKey };
}

/**
 * Validate and consume a game session token. Returns the per-session HMAC key
 * for verifying the score checksum. Throws on invalid/expired/already-used tokens.
 */
export async function consumeSession(
  db: D1Database,
  scoreHmacSecret: string,
  userId: string,
  gameSessionToken: string,
): Promise<string> {
  // Step 1: Verify HMAC signature and extract nonce
  const nonce = await verifyToken(gameSessionToken, userId, scoreHmacSecret);
  if (!nonce) {
    throw new GameSessionError('Invalid game session token', 403);
  }

  // Step 2: DB lookup — must exist, belong to user, be unused, not expired
  const session = await GameSessionModel.findValidSession(db, nonce, userId);
  if (!session) {
    throw new GameSessionError('Game session not found, expired, or already used', 403);
  }

  // Step 3: Mark as consumed atomically
  await GameSessionModel.consumeSession(db, session.id);

  return session.hmac_key;
}

// ─── Error ─────────────────────────────────────────────────────────────────

export class GameSessionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'GameSessionError';
  }
}
