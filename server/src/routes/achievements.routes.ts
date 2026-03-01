/**
 * @fileoverview Achievements routes — Cloudflare Workers / Hono port.
 */

import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import * as AchievementModel from '../models/achievement.model';
import * as ProgressionModel from '../models/progression.model';

type AchEnv = { Bindings: Env; Variables: AppVariables };

export const achievementsRoutes = new Hono<AchEnv>();

const achievementUnlockLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  prefix: 'ach_unlock_user',
});

interface AchievementEntry {
  achievementId: string;
  unlockedAt: string | null;
}

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

// All routes require auth
achievementsRoutes.use('*', requireAuth);

/**
 * GET /
 * Return all achievements for the authenticated user, merging DB rows + legacy progression data.
 */
achievementsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const dbRows = await AchievementModel.getAchievementsByUserId(c.env.DB, userId);
  const merged = new Map<string, AchievementEntry>();

  for (const row of dbRows) {
    merged.set(row.achievement_id, {
      achievementId: row.achievement_id,
      unlockedAt: row.unlocked_at ?? null,
    });
  }

  // Merge legacy achievements from progression data
  const progression = await ProgressionModel.getProgressionByUserId(c.env.DB, userId);

  let progData: Record<string, unknown> | null = null;
  if (progression?.data) {
    try {
      progData = typeof progression.data === 'string'
        ? JSON.parse(progression.data)
        : (progression.data as Record<string, unknown>);
    } catch {
      progData = null;
    }
  }

  const legacyIds = readLegacyAchievementIds(progData);
  for (const achievementId of legacyIds) {
    if (!merged.has(achievementId)) {
      merged.set(achievementId, { achievementId, unlockedAt: null });
    }
  }

  return c.json({ achievements: Array.from(merged.values()) });
});

/**
 * POST /:id
 * Unlock a specific achievement for the authenticated user.
 */
achievementsRoutes.post('/:id', achievementUnlockLimiter, async (c) => {
  const userId = c.get('userId');
  const achievementId = c.req.param('id');

  if (!achievementId || achievementId.length > 64) {
    return c.json({ error: 'Invalid achievement id' }, 400);
  }

  await AchievementModel.unlockAchievement(c.env.DB, userId, achievementId);
  return c.json({ ok: true });
});
