/**
 * @fileoverview Neon Siege API — Cloudflare Workers entry point (Hono).
 *
 * Composes all route groups with CORS, global error handler, and exports
 * the default fetch handler expected by the Workers runtime.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, AppVariables } from './types';
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { leaderboardRoutes } from './routes/leaderboard.routes';
import { saveRoutes } from './routes/save.routes';
import { creditRoutes } from './routes/credit.routes';
import { progressionRoutes } from './routes/progression.routes';
import { achievementsRoutes } from './routes/achievements.routes';

type AppEnv = { Bindings: Env; Variables: AppVariables };

const app = new Hono<AppEnv>();

// ─── CORS ────────────────────────────────────────────────────────────────────

app.use(
  '*',
  async (c, next) => {
    const allowedRaw = c.env.ALLOWED_ORIGINS || '*';
    const origins = allowedRaw === '*' ? ['*'] : allowedRaw.split(',').map((o) => o.trim());

    const corsMiddleware = cors({
      origin: origins.length === 1 && origins[0] === '*' ? '*' : origins,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Length'],
      credentials: true,
      maxAge: 86400,
    });

    return corsMiddleware(c, next);
  },
);

// ─── Route groups ────────────────────────────────────────────────────────────

app.route('/api', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/leaderboard', leaderboardRoutes);
app.route('/api/save', saveRoutes);
app.route('/api/credits', creditRoutes);
app.route('/api/progression', progressionRoutes);
app.route('/api/achievements', achievementsRoutes);

// ─── Global 404 ──────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: 'Not found' }, 404),
);

// ─── Global error handler ────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Export ──────────────────────────────────────────────────────────────────

export default app;
