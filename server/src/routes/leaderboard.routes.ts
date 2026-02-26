import { Elysia, t } from 'elysia';
import { requireAuth, optionalAuth } from '../middleware/authenticate';
import * as leaderboardService from '../services/leaderboard.service';

const difficultySchema = t.Union([t.Literal('easy'), t.Literal('normal'), t.Literal('hard')]);

export const leaderboardRoutes = new Elysia({ prefix: '/api/leaderboard' })

  // Public leaderboard with optional auth (to include user's rank)
  .use(optionalAuth)
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
  )

  // Authenticated endpoints
  .use(requireAuth)
  .get(
    '/me',
    async ({ query, userId }) => {
      const difficulty = query.difficulty || 'normal';
      const limit = Math.min(parseInt(query.limit || '10'), 50);

      return leaderboardService.getUserEntries(userId, difficulty, limit);
    },
    {
      query: t.Object({
        difficulty: t.Optional(difficultySchema),
        limit: t.Optional(t.String()),
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
