/**
 * @fileoverview Game session model — D1 operations for anti-cheat game sessions.
 *
 * A game session is created when a run starts and consumed when the score is
 * submitted. Each session is single-use, time-bounded, and carries a per-session
 * HMAC key used for client-side score checksum signing.
 */

import { queryOne, run } from '../db';

/** How long a game session stays valid (2 hours). */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface GameSession {
  id: string;
  user_id: string;
  nonce: string;
  hmac_key: string;
  created_at: string;
  used_at: string | null;
  expires_at: string;
}

/**
 * Create a new game session for a user.
 */
export async function createGameSession(
  db: D1Database,
  userId: string,
  nonce: string,
  hmacKey: string,
): Promise<GameSession> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await run(
    db,
    `INSERT INTO game_sessions (id, user_id, nonce, hmac_key, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, nonce, hmacKey, expiresAt],
  );

  return {
    id,
    user_id: userId,
    nonce,
    hmac_key: hmacKey,
    created_at: new Date().toISOString(),
    used_at: null,
    expires_at: expiresAt,
  };
}

/**
 * Find a valid (unused, not expired) game session by nonce for a specific user.
 */
export async function findValidSession(
  db: D1Database,
  nonce: string,
  userId: string,
): Promise<GameSession | null> {
  return queryOne<GameSession>(
    db,
    `SELECT * FROM game_sessions
     WHERE nonce = ? AND user_id = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    [nonce, userId],
  );
}

/**
 * Mark a game session as consumed (used_at = now).
 */
export async function consumeSession(db: D1Database, sessionId: string): Promise<void> {
  await run(
    db,
    `UPDATE game_sessions SET used_at = datetime('now') WHERE id = ?`,
    [sessionId],
  );
}

/**
 * Delete expired or old sessions (housekeeping).
 */
export async function cleanExpiredSessions(db: D1Database): Promise<void> {
  await run(
    db,
    `DELETE FROM game_sessions WHERE expires_at < datetime('now')`,
    [],
  );
}

/**
 * Count active (unused) sessions for a user. Used to limit concurrent sessions.
 */
export async function countActiveSessions(
  db: D1Database,
  userId: string,
): Promise<number> {
  const row = await queryOne<{ cnt: number }>(
    db,
    `SELECT COUNT(*) as cnt FROM game_sessions
     WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    [userId],
  );
  return row?.cnt ?? 0;
}
