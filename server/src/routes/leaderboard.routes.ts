import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import * as leaderboardService from '../services/leaderboard.service';

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

      return leaderboardService.getLeaderboard(
        difficulty,
        limit,
        offset,
        userId ?? undefined
      );
    },
    {
      query: t.Object({
        difficulty: t.Optional(difficultySchema),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
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
    async ({ body, userId, set }) => {
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
          clientVersion: body.clientVersion,
          checksum: body.checksum,
        });
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
        wave: t.Number({ minimum: 1, maximum: 30 }),
        kills: t.Number({ minimum: 0 }),
        maxCombo: t.Number({ minimum: 0 }),
        level: t.Number({ minimum: 1 }),
        isVictory: t.Boolean(),
        runDetails: t.Optional(t.Any()),
        gameDurationMs: t.Optional(t.Number()),
        clientVersion: t.Optional(t.String()),
        checksum: t.Optional(t.String()),
      }),
    }
  );

export const leaderboardRoutes = new Elysia()
  .use(publicRoutes)
  .use(authRoutes);
