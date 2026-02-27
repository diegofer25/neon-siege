import { Elysia } from 'elysia';
import cors from '@elysiajs/cors';
import { env } from '../config/env';

/**
 * Build a production origin matcher.
 * Supports ALLOWED_ORIGINS env var (comma-separated) with a safe fallback regex.
 */
function getProductionOrigin(): RegExp | string[] {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  // Anchored regex: only match neon-siege.com and its subdomains over HTTPS
  return /^https:\/\/([a-z0-9-]+\.)*neon-siege\.com$/;
}

export const corsPlugin = new Elysia({ name: 'cors' }).use(
  cors({
    origin: env.NODE_ENV === 'production' ? getProductionOrigin() : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
