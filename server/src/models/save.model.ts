/**
 * @fileoverview Save model — D1/SQLite port.
 */

import { query, queryOne, run, nowISO, newId } from '../db';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SaveState {
  id: string;
  user_id: string;
  schema_version: number;
  save_data: string; // JSON text
  wave: number;
  game_state: string;
  session_token: string;
  save_version: number;
  checksum: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ─── Save state ────────────────────────────────────────────────────────────────

export async function getSaveByUserId(db: D1Database, userId: string): Promise<SaveState | null> {
  return queryOne<SaveState>(db, 'SELECT * FROM save_states WHERE user_id = ?', [userId]);
}

/**
 * Insert or update a save. On conflict (same user_id), increment save_version.
 *
 * D1 doesn't support RETURNING, so we select after upsert.
 */
export async function upsertSave(
  db: D1Database,
  userId: string,
  saveData: unknown,
  wave: number,
  gameState: string,
  sessionToken: string,
  schemaVersion: number,
): Promise<SaveState> {
  const id = newId();
  const now = nowISO();
  const json = JSON.stringify(saveData);

  // Check if save exists
  const existing = await getSaveByUserId(db, userId);

  if (!existing) {
    await run(
      db,
      `INSERT INTO save_states (id, user_id, save_data, wave, game_state, session_token, schema_version, save_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, userId, json, wave, gameState, sessionToken, schemaVersion, now, now],
    );
  } else {
    await run(
      db,
      `UPDATE save_states SET
        save_data = ?, wave = ?, game_state = ?, session_token = ?,
        schema_version = ?, save_version = save_version + 1, updated_at = ?
       WHERE user_id = ?`,
      [json, wave, gameState, sessionToken, schemaVersion, now, userId],
    );
  }

  return (await getSaveByUserId(db, userId))!;
}

export async function deleteSave(db: D1Database, userId: string): Promise<void> {
  await run(db, 'DELETE FROM save_states WHERE user_id = ?', [userId]);
}

// ─── Save sessions ─────────────────────────────────────────────────────────────

export async function createSession(
  db: D1Database,
  userId: string,
  token: string,
  expiresAt: string,
): Promise<void> {
  const id = newId();
  await run(
    db,
    'INSERT INTO save_sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, token, expiresAt, nowISO()],
  );
}

export async function findValidSession(
  db: D1Database,
  token: string,
  userId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM save_sessions
     WHERE token = ? AND user_id = ? AND expires_at > datetime('now')`,
    [token, userId],
  );
  return row !== null;
}

export async function cleanExpiredSessions(db: D1Database): Promise<void> {
  await run(db, `DELETE FROM save_sessions WHERE expires_at < datetime('now')`, []);
}
