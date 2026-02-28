import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import * as saveService from '../services/save.service';
import { SaveError } from '../services/save.service';
import { createRateLimiter } from '../middleware/rateLimit';
import * as UserModel from '../models/user.model';

const saveWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export const saveRoutes = new Elysia({ prefix: '/api/save' })
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

    const user = await UserModel.findById(payload.sub as string);
    if (!user) {
      set.status = 401;
      throw new Error('Authenticated user not found');
    }

    if (!UserModel.isRegisteredUser(user)) {
      set.status = 403;
      throw new Error('Saving is only available for registered accounts');
    }

    return { userId: payload.sub as string };
  })

  /**
   * POST /api/save/session
   * Issue a signed session token that authorises subsequent save writes.
   * Must be called when a real game run begins.  The token is stored in
   * save_sessions and expires after 48 h.
   */
  .post('/session', async ({ userId }) => {
    const token = await saveService.startSession(userId);
    return { token };
  })

  /**
   * GET /api/save
   * Return the authenticated user's current save state (or 404).
   */
  .get('/', async ({ userId, set }) => {
    const save = await saveService.loadSave(userId);
    if (!save) {
      set.status = 404;
      return { error: 'No save found' };
    }
    return { save };
  })

  /**
   * PUT /api/save
   * Persist a save state.  Requires a valid session token that was issued
   * via POST /api/save/session — prevents saves crafted outside a real game.
   */
  .put(
    '/',
    async ({ body, userId, set }) => {
      try {
        await saveService.persistSave(
          userId,
          body.sessionToken,
          body.saveData,
          body.wave,
          body.gameState,
          body.schemaVersion ?? 2
        );
        return { ok: true };
      } catch (err) {
        if (err instanceof SaveError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      beforeHandle: [saveWriteLimiter],
      body: t.Object({
        sessionToken: t.String({ minLength: 10 }),
        saveData: t.Object({}, { additionalProperties: true }),
        wave: t.Integer({ minimum: 1, maximum: 100 }),
        gameState: t.String({ minLength: 1 }),
        schemaVersion: t.Optional(t.Integer({ minimum: 1 })),
      }),
      // Reject payloads larger than 256 KB to prevent DoS via oversized saves
      parse: ({ request, contentType }) => {
        if (contentType === 'application/json') {
          return request.text().then(text => {
            if (text.length > 256 * 1024) {
              throw new SaveError('Save payload too large', 413);
            }
            return JSON.parse(text);
          });
        }
      },
    }
  )

  /**
   * DELETE /api/save
   * Remove the authenticated user's save state.
   */
  .delete('/', async ({ userId }) => {
    await saveService.deleteSave(userId);
    return { ok: true };
  });
