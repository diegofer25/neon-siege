/**
 * @fileoverview Save service — Cloudflare Workers port.
 *
 * Owns session-token generation/verification and save persistence.
 *
 * Security model: HMAC-SHA256 signed session tokens bound to userId.
 * Verification is two-layered:
 *   1. Cryptographic HMAC check (fast, no DB)
 *   2. Database lookup (token exists and not expired)
 */

import * as SaveModel from '../models/save.model';

/** How long a game-session token stays valid (48 h). */
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

// ─── Token helpers ─────────────────────────────────────────────────────────────

async function _getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function _toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function _fromBase64Url(b64: string): string {
  return atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
}

async function _buildToken(userId: string, secret: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const payload = `${userId}:${nonce}`;

  const key = await _getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${_toBase64Url(payload)}.${sigHex}`;
}

async function _verifyTokenSignature(
  token: string,
  userId: string,
  secret: string,
): Promise<boolean> {
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

  if (!payload.startsWith(`${userId}:`)) return false;

  const key = await _getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === sigHex;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function startSession(
  db: D1Database,
  env: { SAVE_HMAC_SECRET: string },
  userId: string,
): Promise<string> {
  const token = await _buildToken(userId, env.SAVE_HMAC_SECRET);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await SaveModel.createSession(db, userId, token, expiresAt);

  // Opportunistic cleanup — fire and forget in Workers (no dangling promise issues)
  SaveModel.cleanExpiredSessions(db).catch(() => {});

  return token;
}

export async function persistSave(
  db: D1Database,
  env: { SAVE_HMAC_SECRET: string },
  userId: string,
  sessionToken: string,
  saveData: unknown,
  wave: number,
  gameState: string,
  schemaVersion: number,
): Promise<void> {
  // Layer 1 — cryptographic integrity
  const sigValid = await _verifyTokenSignature(sessionToken, userId, env.SAVE_HMAC_SECRET);
  if (!sigValid) {
    throw new SaveError('Invalid session token', 403);
  }

  // Layer 2 — DB existence + expiry
  const sessionExists = await SaveModel.findValidSession(db, sessionToken, userId);
  if (!sessionExists) {
    throw new SaveError('Session token not found or expired', 403);
  }

  if (wave < 1 || wave > 100) {
    throw new SaveError('Invalid wave number in save data', 400);
  }

  await SaveModel.upsertSave(db, userId, saveData, wave, gameState, sessionToken, schemaVersion);
}

export async function loadSave(
  db: D1Database,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const row = await SaveModel.getSaveByUserId(db, userId);
  if (!row) return null;

  // save_data is stored as JSON text in D1
  let saveData: Record<string, unknown>;
  try {
    saveData = typeof row.save_data === 'string' ? JSON.parse(row.save_data) : (row.save_data as Record<string, unknown>);
  } catch {
    saveData = {};
  }

  return {
    ...saveData,
    schemaVersion: row.schema_version,
    savedAt: new Date(row.updated_at).getTime(),
    wave: row.wave,
    gameState: row.game_state,
  };
}

export async function deleteSave(db: D1Database, userId: string): Promise<void> {
  await SaveModel.deleteSave(db, userId);
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class SaveError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'SaveError';
  }
}
