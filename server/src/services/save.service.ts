/**
 * Save service — owns session-token generation/verification and save persistence.
 *
 * Security model
 * ──────────────
 * A "save session" is a short-lived token that the server issues when the client
 * starts a real game run (POST /api/save/session).  Every subsequent PUT /api/save
 * must include this token.  The token is:
 *
 *   base64url(userId + ":" + randomNonce) + "." + HMAC-SHA256(payload, secret)
 *
 * Verification is two-layered:
 *   1. Cryptographic: re-derive the HMAC and compare — proves the token was issued
 *      by this server and hasn't been tampered with.
 *   2. Database: confirm the token is still in save_sessions (not expired / revoked).
 *
 * This means an attacker who intercepts a token cannot forge saves for a different
 * user, and crafted requests without a real session token are rejected outright.
 */

import { env } from '../config/env';
import * as SaveModel from '../models/save.model';

/** How long a game-session token stays valid (48 h). */
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

// ─── Token helpers ─────────────────────────────────────────────────────────────

async function _getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SAVE_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function _toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _fromBase64Url(b64: string): string {
  return atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
}

/** Build a signed token embedding `userId` so tokens can't be cross-user replayed. */
async function _buildToken(userId: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const payload = `${userId}:${nonce}`;

  const key = await _getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${_toBase64Url(payload)}.${sigHex}`;
}

/** Verify the token's HMAC without touching the DB. */
async function _verifyTokenSignature(token: string, userId: string): Promise<boolean> {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;

  const b64Payload = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  let payload: string;
  try {
    payload = _fromBase64Url(b64Payload);
  } catch {
    return false;
  }

  // The payload must be bound to this user
  if (!payload.startsWith(`${userId}:`)) return false;

  const key = await _getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === sigHex;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Issue a new game-session token for an authenticated user.
 * Called when the client starts (or resumes) a game run.
 */
export async function startSession(userId: string): Promise<string> {
  const token = await _buildToken(userId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await SaveModel.createSession(userId, token, expiresAt);

  // Opportunistically clean up expired rows; ignore errors.
  SaveModel.cleanExpiredSessions().catch(() => {});

  return token;
}

/**
 * Validate a session token and persist the save state.
 * Throws if the token is invalid, expired, or doesn't belong to the user.
 */
export async function persistSave(
  userId: string,
  sessionToken: string,
  saveData: unknown,
  wave: number,
  gameState: string,
  schemaVersion: number
): Promise<void> {
  // Layer 1 — cryptographic integrity check (fast, no DB)
  const sigValid = await _verifyTokenSignature(sessionToken, userId);
  if (!sigValid) {
    throw new SaveError('Invalid session token', 403);
  }

  // Layer 2 — existence + expiry check (DB)
  const sessionExists = await SaveModel.findValidSession(sessionToken, userId);
  if (!sessionExists) {
    throw new SaveError('Session token not found or expired', 403);
  }

  // Sanity-check the wave number
  if (wave < 1 || wave > 100) {
    throw new SaveError('Invalid wave number in save data', 400);
  }

  await SaveModel.upsertSave(userId, saveData, wave, gameState, sessionToken, schemaVersion);
}

/**
 * Load an authenticated user's save state.
 * Returns null if no save exists.
 */
export async function loadSave(userId: string): Promise<Record<string, unknown> | null> {
  const row = await SaveModel.getSaveByUserId(userId);
  if (!row) return null;

  return {
    ...(row.save_data as Record<string, unknown>),
    schemaVersion: row.schema_version,
    savedAt: row.updated_at.getTime(),
    wave: row.wave,
    gameState: row.game_state,
  };
}

/** Delete an authenticated user's save state. */
export async function deleteSave(userId: string): Promise<void> {
  await SaveModel.deleteSave(userId);
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class SaveError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'SaveError';
  }
}
