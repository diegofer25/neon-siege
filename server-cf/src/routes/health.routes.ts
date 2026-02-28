/**
 * @fileoverview Health check route — Cloudflare Workers / Hono.
 */

import { Hono } from 'hono';
import type { Env } from '../types';

type HealthEnv = { Bindings: Env };

export const healthRoutes = new Hono<HealthEnv>();

healthRoutes.get('/health', async (c) => {
  let dbOk = false;
  try {
    await c.env.DB.prepare('SELECT 1').run();
    dbOk = true;
  } catch {
    /* DB unreachable */
  }

  return c.json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});
