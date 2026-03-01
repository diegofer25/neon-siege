/**
 * @fileoverview Progression model — D1/SQLite port.
 */

import { queryOne, run, nowISO } from '../db';

export interface ProgressionRow {
  id: number;
  user_id: string;
  data: string; // JSON text
  schema_version: number;
  updated_at: string;
}

export async function getProgressionByUserId(
  db: D1Database,
  userId: string,
): Promise<ProgressionRow | null> {
  return queryOne<ProgressionRow>(
    db,
    'SELECT data, schema_version, updated_at FROM user_progression WHERE user_id = ?',
    [userId],
  );
}

export async function upsertProgression(
  db: D1Database,
  userId: string,
  data: unknown,
  schemaVersion: number,
): Promise<void> {
  const now = nowISO();
  await run(
    db,
    `INSERT INTO user_progression (user_id, data, schema_version, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id)
     DO UPDATE SET data = excluded.data, schema_version = excluded.schema_version, updated_at = ?`,
    [userId, JSON.stringify(data), schemaVersion, now, now],
  );
}
