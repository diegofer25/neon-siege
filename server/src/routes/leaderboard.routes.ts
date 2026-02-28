import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import * as leaderboardService from '../services/leaderboard.service';
import * as UserModel from '../models/user.model';
import { env } from '../config/env';
import { extractClientIp, resolveLocation } from '../services/geolocation.service';

const difficultySchema = t.Union([t.Literal('easy'), t.Literal('normal'), t.Literal('hard')]);

// Public leaderboard (optional auth to include user's rank)
const publicRoutes = new Elysia({ prefix: '/api/leaderboard' })
  .use(authPlugin)
  .resolve(async ({ accessJwt, headers }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { userId: null as string | null };
    }
    const token = authHeader.slice(7);
    const payload = await accessJwt.verify(token);
    return { userId: payload ? (payload.sub as string) : null as string | null };
  })
  .get(
    '/',
    async ({ query, userId }) => {
      const difficulty = query.difficulty || 'normal';
      const limit = Math.min(parseInt(query.limit || '50'), 100);
      const offset = Math.max(parseInt(query.offset || '0'), 0);
      const scope = query.scope || 'global';

      // Build location filter from authenticated user's stored location
      let locationFilter;
      if (scope !== 'global' && userId) {
        const user = await UserModel.findById(userId);
        if (user?.country_code) {
          locationFilter = { countryCode: user.country_code };
          if ((scope === 'region' || scope === 'city') && user.region) {
            locationFilter = { ...locationFilter, region: user.region };
          }
          if (scope === 'city' && user.city) {
            locationFilter = { ...locationFilter, city: user.city };
          }
        }
      }

      return leaderboardService.getLeaderboard(
        difficulty,
        limit,
        offset,
        userId ?? undefined,
        locationFilter
      );
    },
    {
      query: t.Object({
        difficulty: t.Optional(difficultySchema),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        scope: t.Optional(
          t.Union([
            t.Literal('global'),
            t.Literal('country'),
            t.Literal('region'),
            t.Literal('city'),
          ])
        ),
      }),
    }
  );

// Authenticated leaderboard endpoints
const authRoutes = new Elysia({ prefix: '/api/leaderboard' })
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
    return {
      userId: payload.sub as string,
      displayName: payload.displayName as string,
    };
  })
  .get(
    '/me',
    async ({ query, userId }) => {
      const difficulty = query.difficulty || 'normal';
      return leaderboardService.getUserEntry(userId, difficulty);
    },
    {
      query: t.Object({
        difficulty: t.Optional(difficultySchema),
      }),
    }
  )
  .post(
    '/submit',
    async ({ body, userId, set, headers, server, request }) => {
      try {
        const result = await leaderboardService.submitScore({
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

        // Resolve geolocation from IP and update user profile (best-effort, non-blocking on failure)
        if (env.GEOIP_ENABLED) {
          const ip = extractClientIp(headers, server ?? undefined, request);
          if (ip) {
            resolveLocation(ip).then(async (geo) => {
              if (!geo) return;
              // Only update if location differs from what's stored
              const user = await UserModel.findById(userId);
              if (
                user &&
                (user.country_code !== geo.countryCode ||
                  user.region !== geo.region ||
                  user.city !== geo.city)
              ) {
                await UserModel.updateLocation(userId, geo);
              }
            }).catch(() => { /* ignore geo errors */ });
          }
        }

        return result;
      } catch (err: any) {
        set.status = 400;
        return { error: err.message };
      }
    },
    {
      body: t.Object({
        difficulty: difficultySchema,
        score: t.Number({ minimum: 0 }),
        wave: t.Number({ minimum: 1 }),
        kills: t.Number({ minimum: 0 }),
        maxCombo: t.Number({ minimum: 0 }),
        level: t.Number({ minimum: 1 }),
        isVictory: t.Boolean(),
        runDetails: t.Optional(t.Any()),
        gameDurationMs: t.Optional(t.Number()),
        startWave: t.Optional(t.Number({ minimum: 1 })),
        clientVersion: t.Optional(t.String()),
        checksum: t.Optional(t.String()),
        continuesUsed: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  );

export const leaderboardRoutes = new Elysia()
  .use(publicRoutes)
  .use(authRoutes);
