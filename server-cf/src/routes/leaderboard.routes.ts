/**
 * @fileoverview Leaderboard routes — Cloudflare Workers / Hono port.
 */

import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { requireAuth, optionalAuth } from '../middleware/auth';
import * as leaderboardService from '../services/leaderboard.service';
import * as UserModel from '../models/user.model';
import {
  resolveLocation,
  resolveLocationFromCf,
  getClientIp,
} from '../services/geolocation.service';

type LBEnv = { Bindings: Env; Variables: AppVariables };

export const leaderboardRoutes = new Hono<LBEnv>();

// ─── Public: GET / (optional auth for user rank) ─────────────────────────────

leaderboardRoutes.get('/', optionalAuth, async (c) => {
  const q = c.req.query();
  const difficulty = q.difficulty || 'normal';
  const limit = Math.min(parseInt(q.limit || '50', 10), 100);
  const offset = Math.max(parseInt(q.offset || '0', 10), 0);
  const scope = q.scope || 'global';
  const userId = c.get('userId') || undefined;

  let locationFilter;
  if (scope !== 'global' && userId) {
    const user = await UserModel.findById(c.env.DB, userId);
    if (user?.country_code) {
      locationFilter: { countryCode: user.country_code };
      locationFilter = { countryCode: user.country_code } as any;
      if ((scope === 'region' || scope === 'city') && user.region) {
        locationFilter = { ...locationFilter, region: user.region };
      }
      if (scope === 'city' && user.city) {
        locationFilter = { ...locationFilter, city: user.city };
      }
    }
  }

  const result = await leaderboardService.getLeaderboard(
    c.env.DB,
    difficulty,
    limit,
    offset,
    userId,
    locationFilter,
  );

  return c.json(result);
});

// ─── Authenticated: GET /me ──────────────────────────────────────────────────

leaderboardRoutes.get('/me', requireAuth, async (c) => {
  const difficulty = c.req.query('difficulty') || 'normal';
  const userId = c.get('userId');
  const entry = await leaderboardService.getUserEntry(c.env.DB, userId, difficulty);
  return c.json(entry ?? { entry: null });
});

// ─── Authenticated: POST /submit ─────────────────────────────────────────────

leaderboardRoutes.post('/submit', requireAuth, async (c) => {
  const userId = c.get('userId');

  // Check if user is registered (not anonymous)
  const user = await UserModel.findById(c.env.DB, userId);
  if (!user || !UserModel.isRegisteredUser(user)) {
    return c.json({ error: 'Leaderboard submission requires a registered account' }, 403);
  }

  const body = await c.req.json<{
    difficulty?: string;
    score?: number;
    wave?: number;
    kills?: number;
    maxCombo?: number;
    level?: number;
    isVictory?: boolean;
    runDetails?: Record<string, unknown>;
    gameDurationMs?: number;
    startWave?: number;
    clientVersion?: string;
    checksum?: string;
    continuesUsed?: number;
  }>();

  // Basic validation
  if (
    !body.difficulty ||
    body.score === undefined ||
    body.wave === undefined ||
    body.kills === undefined ||
    body.maxCombo === undefined ||
    body.level === undefined ||
    body.isVictory === undefined
  ) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  try {
    const result = await leaderboardService.submitScore(c.env.DB, {
      userId,
      difficulty: body.difficulty,
      score: body.score,
      wave: body.wave,
      kills: body.kills,
      maxCombo: body.maxCombo,
      level: body.level,
      isVictory: body.isVictory,
      runDetails: body.runDetails || {},
      gameDurationMs: body.gameDurationMs,
      startWave: body.startWave,
      clientVersion: body.clientVersion,
      checksum: body.checksum,
      continuesUsed: body.continuesUsed,
    });

    // Geo-tagging (best-effort, non-blocking)
    if (c.env.GEOIP_ENABLED === 'true') {
      // Prefer CF-native geo, fallback to ip-api
      const cfGeo = resolveLocationFromCf(c.req.raw);
      const geoPromise = cfGeo
        ? Promise.resolve(cfGeo)
        : resolveLocation(getClientIp(c.req.raw) ?? '');

      geoPromise
        .then(async (geo) => {
          if (!geo) return;
          const u = await UserModel.findById(c.env.DB, userId);
          if (
            u &&
            (u.country_code !== geo.countryCode ||
              u.region !== geo.region ||
              u.city !== geo.city)
          ) {
            await UserModel.updateLocation(c.env.DB, userId, geo);
          }
        })
        .catch(() => {});
    }

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});
