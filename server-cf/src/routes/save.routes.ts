/**
 * @fileoverview Save routes — Cloudflare Workers / Hono port.
 */

import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import * as saveService from '../services/save.service';
import { SaveError } from '../services/save.service';
import * as UserModel from '../models/user.model';

type SaveEnv = { Bindings: Env; Variables: AppVariables };

export const saveRoutes = new Hono<SaveEnv>();

const saveWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

/**
 * Middleware: ensure user is registered (not anonymous).
 */
const requireRegistered = async (c: any, next: any) => {
  const userId = c.get('userId');
  const user = await UserModel.findById(c.env.DB, userId);
  if (!user) {
    return c.json({ error: 'Authenticated user not found' }, 401);
  }
  if (!UserModel.isRegisteredUser(user)) {
    return c.json({ error: 'Saving is only available for registered accounts' }, 403);
  }
  await next();
};

// All save routes require auth + registered user
saveRoutes.use('*', requireAuth);
saveRoutes.use('*', requireRegistered);

/**
 * POST /session
 * Issue a signed session token for subsequent save writes.
 */
saveRoutes.post('/session', async (c) => {
  const userId = c.get('userId');
  const token = await saveService.startSession(c.env.DB, c.env, userId);
  return c.json({ token });
});

/**
 * GET /
 * Return the authenticated user's current save state.
 */
saveRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const save = await saveService.loadSave(c.env.DB, userId);
  if (!save) {
    return c.json({ error: 'No save found' }, 404);
  }
  return c.json({ save });
});

/**
 * PUT /
 * Persist a save state. Requires a valid session token.
 */
saveRoutes.put('/', saveWriteLimiter, async (c) => {
  const userId = c.get('userId');

  // Check content length to prevent oversized saves
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > 256 * 1024) {
    return c.json({ error: 'Save payload too large' }, 413);
  }

  const body = await c.req.json<{
    sessionToken?: string;
    saveData?: Record<string, unknown>;
    wave?: number;
    gameState?: string;
    schemaVersion?: number;
  }>();

  if (!body.sessionToken || !body.saveData || !body.wave || !body.gameState) {
    return c.json({ error: 'Missing required fields: sessionToken, saveData, wave, gameState' }, 400);
  }

  try {
    await saveService.persistSave(
      c.env.DB,
      c.env,
      userId,
      body.sessionToken,
      body.saveData,
      body.wave,
      body.gameState,
      body.schemaVersion ?? 2,
    );
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof SaveError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

/**
 * DELETE /
 * Remove the authenticated user's save state.
 */
saveRoutes.delete('/', async (c) => {
  const userId = c.get('userId');
  await saveService.deleteSave(c.env.DB, userId);
  return c.json({ ok: true });
});
