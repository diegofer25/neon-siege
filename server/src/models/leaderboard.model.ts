import { query, queryOne } from '../config/database';

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  difficulty: 'easy' | 'normal' | 'hard';
  score: number;
  wave: number;
  kills: number;
  max_combo: number;
  level: number;
  is_victory: boolean;
  run_details: RunDetails;
  game_duration_ms: number | null;
  client_version: string | null;
  checksum: string | null;
  flagged: boolean;
  created_at: Date;
}

export interface RunDetails {
  skills?: {
    ranks?: Record<string, number>;
    equippedPassives?: string[];
    equippedActives?: string[];
    equippedUltimate?: string | null;
  };
  ascensions?: string[];
  attributes?: {
    STR?: number;
    DEX?: number;
    VIT?: number;
    INT?: number;
    LUCK?: number;
  };
  stats?: {
    damageMod?: number;
    fireRateMod?: number;
    maxHp?: number;
    maxShieldHp?: number;
    piercingLevel?: number;
    hasTripleShot?: boolean;
    hasHomingShots?: boolean;
    explosiveShots?: boolean;
  };
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

/**
 * Upsert a leaderboard entry — one record per user per difficulty.
 * Only replaces the existing record if the new score is higher.
 */
export async function upsertEntry(data: CreateEntryData): Promise<{ entry: LeaderboardEntry; isNewBest: boolean }> {
  const result = await queryOne<LeaderboardEntry>(
    `INSERT INTO leaderboard_entries
      (user_id, difficulty, score, wave, kills, max_combo, level, is_victory, run_details, game_duration_ms, client_version, checksum, flagged, continues_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (user_id, difficulty) DO UPDATE SET
       score = EXCLUDED.score,
       wave = EXCLUDED.wave,
       kills = EXCLUDED.kills,
       max_combo = EXCLUDED.max_combo,
       level = EXCLUDED.level,
       is_victory = EXCLUDED.is_victory,
       run_details = EXCLUDED.run_details,
       game_duration_ms = EXCLUDED.game_duration_ms,
       client_version = EXCLUDED.client_version,
       checksum = EXCLUDED.checksum,
       flagged = EXCLUDED.flagged,
       continues_used = EXCLUDED.continues_used,
       updated_at = NOW()
     WHERE EXCLUDED.score > leaderboard_entries.score
     RETURNING *`,
    [
      data.userId,
      data.difficulty,
      data.score,
      data.wave,
      data.kills,
      data.maxCombo,
      data.level,
      data.isVictory,
      JSON.stringify(data.runDetails),
      data.gameDurationMs ?? null,
      data.clientVersion ?? null,
      data.checksum ?? null,
      data.flagged ?? false,
      data.continuesUsed ?? 0,
    ]
  );

  if (result) {
    return { entry: result, isNewBest: true };
  }

  // Score wasn't higher — return the existing entry
  const existing = await queryOne<LeaderboardEntry>(
    `SELECT * FROM leaderboard_entries WHERE user_id = $1 AND difficulty = $2`,
    [data.userId, data.difficulty]
  );
  return { entry: existing!, isNewBest: false };
}

export async function getLeaderboard(
  difficulty: string,
  limit: number = 50,
  offset: number = 0,
  locationFilter?: LocationFilter
): Promise<{ entries: LeaderboardRow[]; total: number }> {
  // Build dynamic WHERE clauses for location filtering
  const params: any[] = [difficulty];
  let locationWhere = '';

  if (locationFilter?.countryCode) {
    params.push(locationFilter.countryCode);
    locationWhere += ` AND u.country_code = $${params.length}`;
  }
  if (locationFilter?.region) {
    params.push(locationFilter.region);
    locationWhere += ` AND u.region = $${params.length}`;
  }
  if (locationFilter?.city) {
    params.push(locationFilter.city);
    locationWhere += ` AND u.city = $${params.length}`;
  }

  const filterParams = [...params]; // snapshot before limit/offset
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  params.push(limit, offset);

  const [entries, countResult] = await Promise.all([
    query<LeaderboardRow>(
      `SELECT
        le.*,
        u.display_name,
        ROW_NUMBER() OVER (ORDER BY le.score DESC) AS rank
       FROM leaderboard_entries le
       JOIN users u ON u.id = le.user_id
       WHERE le.difficulty = $1${locationWhere}
       ORDER BY le.score DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM leaderboard_entries le
       JOIN users u ON u.id = le.user_id
       WHERE le.difficulty = $1${locationWhere}`,
      filterParams
    ),
  ]);

  return {
    entries,
    total: parseInt(countResult?.count || '0'),
  };
}

export async function getUserEntry(
  userId: string,
  difficulty: string,
): Promise<LeaderboardRow | null> {
  return queryOne<LeaderboardRow>(
    `SELECT
      le.*,
      u.display_name,
      (SELECT COUNT(*) + 1 FROM leaderboard_entries le2
       WHERE le2.difficulty = le.difficulty AND le2.score > le.score AND le2.flagged = FALSE
      ) AS rank
     FROM leaderboard_entries le
     JOIN users u ON u.id = le.user_id
     WHERE le.user_id = $1 AND le.difficulty = $2`,
    [userId, difficulty]
  );
}

export async function getUserRank(
  userId: string,
  difficulty: string,
  locationFilter?: LocationFilter
): Promise<number | null> {
  const params: any[] = [difficulty];
  let locationWhere = '';

  if (locationFilter?.countryCode) {
    params.push(locationFilter.countryCode);
    locationWhere += ` AND u.country_code = $${params.length}`;
  }
  if (locationFilter?.region) {
    params.push(locationFilter.region);
    locationWhere += ` AND u.region = $${params.length}`;
  }
  if (locationFilter?.city) {
    params.push(locationFilter.city);
    locationWhere += ` AND u.city = $${params.length}`;
  }

  const userIdx = params.length + 1;
  params.push(userId);

  const result = await queryOne<{ rank: string }>(
    `SELECT rank FROM (
      SELECT
        le.user_id,
        ROW_NUMBER() OVER (ORDER BY le.score DESC) AS rank
      FROM leaderboard_entries le
      JOIN users u ON u.id = le.user_id
      WHERE le.difficulty = $1${locationWhere}
    ) ranked
    WHERE user_id = $${userIdx}`,
    params
  );
  return result ? parseInt(result.rank) : null;
}
