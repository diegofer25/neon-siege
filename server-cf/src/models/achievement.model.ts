/**
 * @fileoverview Achievement model — D1/SQLite port.
 */

import { query, run, nowISO } from '../db';

export interface UserAchievementRow {
  achievement_id: string;
  unlocked_at: string;
}

export async function getAchievementsByUserId(
  db: D1Database,
  userId: string,
): Promise<UserAchievementRow[]> {
  return query<UserAchievementRow>(
    db,
    `SELECT achievement_id, unlocked_at FROM user_achievements
     WHERE user_id = ? ORDER BY unlocked_at ASC`,
    [userId],
  );
}

export async function unlockAchievement(
  db: D1Database,
  userId: string,
  achievementId: string,
): Promise<void> {
  await run(
    db,
    `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, achievement_id) DO NOTHING`,
    [userId, achievementId, nowISO()],
  );
}
