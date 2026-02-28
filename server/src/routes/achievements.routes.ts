import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import * as AchievementModel from '../models/achievement.model';
import * as ProgressionModel from '../models/progression.model';

type AchievementEntry = {
  achievementId: string;
  unlockedAt: string | null;
};

function readLegacyAchievementIds(data: Record<string, unknown> | null | undefined): string[] {
  if (!data || typeof data !== 'object') return [];
  const rawAchievements = data.achievements;
  if (!rawAchievements || typeof rawAchievements !== 'object' || Array.isArray(rawAchievements)) {
    return [];
  }

  return Object.entries(rawAchievements as Record<string, unknown>)
    .filter(([, value]) => value)
    .map(([id]) => id);
}

export const achievementsRoutes = new Elysia({ prefix: '/api/achievements' })
  .use(authPlugin)
  .resolve(async ({ accessJwt, headers, set }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      set.status = 401;
      throw new Error('Missing or invalid authorization header');
    }
    const token = authHeader.slice(7);
    const payload = await accessJwt.verify(token);
    if (!payload) {
      set.status = 401;
      throw new Error('Invalid or expired access token');
    }
    return { userId: payload.sub as string };
  })
  .get('/', async ({ userId }) => {
    const dbRows = await AchievementModel.getAchievementsByUserId(userId);
    const merged = new Map<string, AchievementEntry>();

    for (const row of dbRows) {
      merged.set(row.achievement_id, {
        achievementId: row.achievement_id,
        unlockedAt: row.unlocked_at ? row.unlocked_at.toISOString() : null,
      });
    }

    const progression = await ProgressionModel.getProgressionByUserId(userId);
    const legacyIds = readLegacyAchievementIds(progression?.data ?? null);
    for (const achievementId of legacyIds) {
      if (!merged.has(achievementId)) {
        merged.set(achievementId, { achievementId, unlockedAt: null });
      }
    }

    return { achievements: Array.from(merged.values()) };
  })
  .post(
    '/:id',
    async ({ userId, params }) => {
      await AchievementModel.unlockAchievement(userId, params.id);
      return { ok: true };
    },
    {
      params: t.Object({
        id: t.String({ minLength: 1, maxLength: 64 }),
      }),
    }
  );
