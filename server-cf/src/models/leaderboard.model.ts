/**
 * @fileoverview Leaderboard model — D1/SQLite port.
 *
 * SQLite notes:
 *   • BOOLEAN stored as INTEGER (0/1)
 *   • JSONB → TEXT, parsed in app code
 *   • ROW_NUMBER() OVER works in SQLite ≥ 3.25 (D1 supports it)
 *   • Positional `?` params
 */

import { query, queryOne, run, nowISO, newId } from '../db';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  difficulty: 'easy' | 'normal' | 'hard';
  score: number;
  wave: number;
  kills: number;
  max_combo: number;
  level: number;
  is_victory: number; // SQLite boolean
  run_details: string; // JSON text
  game_duration_ms: number | null;
  client_version: string | null;
  checksum: string | null;
  flagged: number; // SQLite boolean
  continues_used: number;
  created_at: string;
  updated_at: string;
}

export interface RunDetails {
  skills?: {
    ranks?: Record<string, number>;
    equippedPassives?: string[];
    equippedActives?: string[];
    equippedUltimate?: string | null;
  };
  ascensions?: string[];
  attributes?: Record<string, number>;
  stats?: Record<string, unknown>;
}

export interface LeaderboardRow extends LeaderboardEntry {
  display_name: string;
  rank: number;
}

export interface CreateEntryData {
  userId: string;
  difficulty: string;
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  level: number;
  isVictory: boolean;
  runDetails: RunDetails;
  gameDurationMs?: number;
  clientVersion?: string;
  checksum?: string;
  flagged?: boolean;
  continuesUsed?: number;
}

export interface LocationFilter {
  countryCode?: string;
  region?: string;
  city?: string;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Upsert a leaderboard entry — one record per user per difficulty.
 * Only replaces the existing record if the new score is higher.
 *
 * D1 doesn't support RETURNING *, so we do INSERT + SELECT.
 */
export async function upsertEntry(
  db: D1Database,
  data: CreateEntryData,
): Promise<{ entry: LeaderboardEntry; isNewBest: boolean }> {
  const id = newId();
  const now = nowISO();
  const runDetailsJson = JSON.stringify(data.runDetails);

  // Check existing score first
  const existing = await queryOne<LeaderboardEntry>(
    db,
    'SELECT * FROM leaderboard_entries WHERE user_id = ? AND difficulty = ?',
    [data.userId, data.difficulty],
  );

  if (!existing) {
    // No entry yet — insert
    await run(
      db,
      `INSERT INTO leaderboard_entries
        (id, user_id, difficulty, score, wave, kills, max_combo, level, is_victory,
         run_details, game_duration_ms, client_version, checksum, flagged, continues_used,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.userId, data.difficulty, data.score, data.wave, data.kills,
        data.maxCombo, data.level, data.isVictory ? 1 : 0, runDetailsJson,
        data.gameDurationMs ?? null, data.clientVersion ?? null,
        data.checksum ?? null, data.flagged ? 1 : 0, data.continuesUsed ?? 0,
        now, now,
      ],
    );
    const entry = (await queryOne<LeaderboardEntry>(
      db,
      'SELECT * FROM leaderboard_entries WHERE user_id = ? AND difficulty = ?',
      [data.userId, data.difficulty],
    ))!;
    return { entry, isNewBest: true };
  }

  if (data.score > existing.score) {
    // New high score — update
    await run(
      db,
      `UPDATE leaderboard_entries SET
        score = ?, wave = ?, kills = ?, max_combo = ?, level = ?, is_victory = ?,
        run_details = ?, game_duration_ms = ?, client_version = ?, checksum = ?,
        flagged = ?, continues_used = ?, updated_at = ?
       WHERE user_id = ? AND difficulty = ?`,
      [
        data.score, data.wave, data.kills, data.maxCombo, data.level,
        data.isVictory ? 1 : 0, runDetailsJson, data.gameDurationMs ?? null,
        data.clientVersion ?? null, data.checksum ?? null,
        data.flagged ? 1 : 0, data.continuesUsed ?? 0, now,
        data.userId, data.difficulty,
      ],
    );
    const entry = (await queryOne<LeaderboardEntry>(
      db,
      'SELECT * FROM leaderboard_entries WHERE user_id = ? AND difficulty = ?',
      [data.userId, data.difficulty],
    ))!;
    return { entry, isNewBest: true };
  }

  return { entry: existing, isNewBest: false };
}

export async function getLeaderboard(
  db: D1Database,
  difficulty: string,
  limit: number = 50,
  offset: number = 0,
  locationFilter?: LocationFilter,
): Promise<{ entries: LeaderboardRow[]; total: number }> {
  const params: unknown[] = [difficulty];
  let locationWhere = '';

  if (locationFilter?.countryCode) {
    params.push(locationFilter.countryCode);
    locationWhere += ` AND u.country_code = ?`;
  }
  if (locationFilter?.region) {
    params.push(locationFilter.region);
    locationWhere += ` AND u.region = ?`;
  }
  if (locationFilter?.city) {
    params.push(locationFilter.city);
    locationWhere += ` AND u.city = ?`;
  }

  const countParams = [...params];
  params.push(limit, offset);

  const entries = await query<LeaderboardRow>(
    db,
    `SELECT
      le.*,
      u.display_name,
      ROW_NUMBER() OVER (ORDER BY le.score DESC) AS rank
     FROM leaderboard_entries le
     JOIN users u ON u.id = le.user_id
     WHERE le.difficulty = ?${locationWhere}
     ORDER BY le.score DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  const countResult = await queryOne<{ count: number }>(
    db,
    `SELECT COUNT(*) as count
     FROM leaderboard_entries le
     JOIN users u ON u.id = le.user_id
     WHERE le.difficulty = ?${locationWhere}`,
    countParams,
  );

  return {
    entries,
    total: countResult?.count ?? 0,
  };
}

export async function getUserEntry(
  db: D1Database,
  userId: string,
  difficulty: string,
): Promise<LeaderboardRow | null> {
  return queryOne<LeaderboardRow>(
    db,
    `SELECT
      le.*,
      u.display_name,
      (SELECT COUNT(*) + 1 FROM leaderboard_entries le2
       WHERE le2.difficulty = le.difficulty AND le2.score > le.score AND le2.flagged = 0
      ) AS rank
     FROM leaderboard_entries le
     JOIN users u ON u.id = le.user_id
     WHERE le.user_id = ? AND le.difficulty = ?`,
    [userId, difficulty],
  );
}

export async function getUserRank(
  db: D1Database,
  userId: string,
  difficulty: string,
  locationFilter?: LocationFilter,
): Promise<number | null> {
  const params: unknown[] = [difficulty];
  let locationWhere = '';

  if (locationFilter?.countryCode) {
    params.push(locationFilter.countryCode);
    locationWhere += ` AND u.country_code = ?`;
  }
  if (locationFilter?.region) {
    params.push(locationFilter.region);
    locationWhere += ` AND u.region = ?`;
  }
  if (locationFilter?.city) {
    params.push(locationFilter.city);
    locationWhere += ` AND u.city = ?`;
  }

  params.push(userId);

  const result = await queryOne<{ rank: number }>(
    db,
    `SELECT rank FROM (
      SELECT
        le.user_id,
        ROW_NUMBER() OVER (ORDER BY le.score DESC) AS rank
      FROM leaderboard_entries le
      JOIN users u ON u.id = le.user_id
      WHERE le.difficulty = ?${locationWhere}
    ) ranked
    WHERE user_id = ?`,
    params,
  );
  return result?.rank ?? null;
}
