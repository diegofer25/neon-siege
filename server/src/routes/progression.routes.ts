/**
 * @fileoverview Progression routes — Cloudflare Workers / Hono port.
 */

import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import * as ProgressionModel from '../models/progression.model';

type ProgEnv = { Bindings: Env; Variables: AppVariables };

export const progressionRoutes = new Hono<ProgEnv>();

const progressionWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 60, prefix: 'prog_write' });

// All routes require auth
progressionRoutes.use('*', requireAuth);

/**
 * GET /
 * Return the authenticated user's meta-progression data.
 * Returns { data: {} } when no row exists (fresh account).
 */
progressionRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const row = await ProgressionModel.getProgressionByUserId(c.env.DB, userId);

  if (!row) {
    return c.json({ data: {}, schemaVersion: 1 });
  }

  // data is stored as JSON text in D1
  let data: Record<string, unknown>;
  try {
    data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data as Record<string, unknown>);
  } catch {
    data = {};
  }

  return c.json({ data, schemaVersion: row.schema_version });
});

/**
 * PUT /
 * Persist meta-progression for the authenticated user.
 */
progressionRoutes.put('/', progressionWriteLimiter, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ data?: Record<string, unknown>; schemaVersion?: number }>();

  if (!body.data || typeof body.data !== 'object') {
    return c.json({ error: 'data object is required' }, 400);
  }

  // SECURITY: Limit payload size to prevent abuse (256 KB matches save limit)
  const dataStr = JSON.stringify(body.data);
  if (dataStr.length > 256 * 1024) {
    return c.json({ error: 'Progression data too large' }, 413);
  }

  await ProgressionModel.upsertProgression(
    c.env.DB,
    userId,
    body.data,
    body.schemaVersion ?? 1,
  );

  return c.json({ ok: true });
});
