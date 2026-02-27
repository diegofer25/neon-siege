import { query, queryOne } from '../config/database';

export interface SaveState {
  id: string;
  user_id: string;
  schema_version: number;
  save_data: Record<string, unknown>;
  wave: number;
  game_state: string;
  session_token: string;
  save_version: number;
  checksum: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SaveSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

// ─── Save state ────────────────────────────────────────────────────────────────

export async function getSaveByUserId(userId: string): Promise<SaveState | null> {
  return queryOne<SaveState>('SELECT * FROM save_states WHERE user_id = $1', [userId]);
}

export async function upsertSave(
  userId: string,
  saveData: unknown,
  wave: number,
  gameState: string,
  sessionToken: string,
  schemaVersion: number
): Promise<SaveState> {
  const result = await queryOne<SaveState>(
    `INSERT INTO save_states (user_id, save_data, wave, game_state, session_token, schema_version, save_version)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, 1)
     ON CONFLICT (user_id) DO UPDATE SET
       save_data      = EXCLUDED.save_data,
       wave           = EXCLUDED.wave,
       game_state     = EXCLUDED.game_state,
       session_token  = EXCLUDED.session_token,
       schema_version = EXCLUDED.schema_version,
       save_version   = save_states.save_version + 1,
       updated_at     = NOW()
     RETURNING *`,
    [userId, JSON.stringify(saveData), wave, gameState, sessionToken, schemaVersion]
  );
  return result!;
}

export async function deleteSave(userId: string): Promise<void> {
  await query('DELETE FROM save_states WHERE user_id = $1', [userId]);
}

// ─── Save sessions ─────────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  await query(
    'INSERT INTO save_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

/**
 * Return true if the token exists in save_sessions, belongs to the given user,
 * and has not yet expired.
 */
export async function findValidSession(token: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM save_sessions
     WHERE token = $1 AND user_id = $2 AND expires_at > NOW()`,
    [token, userId]
  );
  return row !== null;
}

/** Remove expired rows to keep the table lean (called opportunistically). */
export async function cleanExpiredSessions(): Promise<void> {
  await query('DELETE FROM save_sessions WHERE expires_at < NOW()', []);
}
