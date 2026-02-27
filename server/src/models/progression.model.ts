import { pool } from '../config/database';

/**
 * Return the stored progression data for a user, or null if none exists.
 */
export async function getProgressionByUserId(
  userId: string
): Promise<{ data: Record<string, unknown>; schema_version: number; updated_at: Date } | null> {
  const { rows } = await pool.query(
    `SELECT data, schema_version, updated_at
       FROM user_progression
      WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

/**
 * Insert or update the progression row for a user.
 */
export async function upsertProgression(
  userId: string,
  data: unknown,
  schemaVersion: number
): Promise<void> {
  await pool.query(
    `INSERT INTO user_progression (user_id, data, schema_version, updated_at)
          VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET data           = EXCLUDED.data,
                   schema_version = EXCLUDED.schema_version,
                   updated_at     = NOW()`,
    [userId, JSON.stringify(data), schemaVersion]
  );
}
