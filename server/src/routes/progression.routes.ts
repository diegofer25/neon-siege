import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import * as ProgressionModel from '../models/progression.model';
import { createRateLimiter } from '../middleware/rateLimit';

const progressionWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

export const progressionRoutes = new Elysia({ prefix: '/api/progression' })
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

  /**
   * GET /api/progression
   * Return the authenticated user's meta-progression data.
   * Returns { data: {} } with an empty object when the user has no row yet
   * (fresh account) so the client never needs to handle 404.
   */
  .get('/', async ({ userId }) => {
    const row = await ProgressionModel.getProgressionByUserId(userId);
    if (!row) return { data: {}, schemaVersion: 1 };
    return { data: row.data, schemaVersion: row.schema_version };
  })

  /**
   * PUT /api/progression
   * Persist meta-progression for the authenticated user.
   * Client is responsible for debouncing before calling this endpoint.
   */
  .put(
    '/',
    async ({ body, userId }) => {
      await ProgressionModel.upsertProgression(userId, body.data, body.schemaVersion ?? 1);
      return { ok: true };
    },
    {
      beforeHandle: [progressionWriteLimiter],
      body: t.Object({
        data: t.Object({}, { additionalProperties: true }),
        schemaVersion: t.Optional(t.Integer({ minimum: 1 })),
      }),
    }
  );
