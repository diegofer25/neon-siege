import { pool } from '../config/database';

export type UserAchievementRow = {
  achievement_id: string;
  unlocked_at: Date;
};

export async function getAchievementsByUserId(userId: string): Promise<UserAchievementRow[]> {
  const { rows } = await pool.query(
    `SELECT achievement_id, unlocked_at
       FROM user_achievements
      WHERE user_id = $1
      ORDER BY unlocked_at ASC`,
    [userId]
  );
  return rows as UserAchievementRow[];
}

export async function unlockAchievement(userId: string, achievementId: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_achievements (user_id, achievement_id)
          VALUES ($1, $2)
     ON CONFLICT (user_id, achievement_id) DO NOTHING`,
    [userId, achievementId]
  );
}
