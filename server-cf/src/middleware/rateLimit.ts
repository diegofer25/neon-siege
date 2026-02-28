/**
 * @fileoverview In-memory sliding-window rate limiter — ported from Elysia version.
 *
 * ⚠️  On Cloudflare Workers, in-memory state is per-isolate, so rate limits are
 *     approximate in production (each edge colo has independent counters).
 *     For strict global rate limiting, move to a KV-based or Durable Object approach.
 *     For a game API with moderate traffic this is sufficient initially.
 */

import { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../types';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Extract key from context. Return null to skip limiting. */
  keyFn?: (c: Context<{ Bindings: Env; Variables: { userId: string; displayName: string } }>) => string | null | Promise<string | null>;
}

interface WindowEntry {
  timestamps: number[];
}

export function createRateLimiter(opts: RateLimitOptions): MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; displayName: string } }> {
  const store = new Map<string, WindowEntry>();
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = opts.windowMs * 2;

  const keyFn =
    opts.keyFn ??
    ((c: Context<{ Bindings: Env; Variables: { userId: string; displayName: string } }>) => c.get('userId') || null);

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    const cutoff = now - opts.windowMs;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }

  return async (c, next) => {
    const key = await keyFn(c);
    if (!key) {
      await next();
      return;
    }

    const now = Date.now();
    cleanup(now);

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    const cutoff = now - opts.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= opts.max) {
      return c.json(
        {
          error: 'Too many requests',
          retryAfterMs: entry.timestamps[0]! + opts.windowMs - now,
        },
        429,
      );
    }

    entry.timestamps.push(now);
    await next();
  };
}

/**
 * Extract the real client IP from incoming request headers.
 * CF-Connecting-IP is set by Cloudflare automatically.
 */
export function getClientIp(c: Context): string | null {
  const cfIp = c.req.header('CF-Connecting-IP');
  if (cfIp) return cfIp;

  const xff = c.req.header('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();

  const realIp = c.req.header('X-Real-IP');
  if (realIp) return realIp.trim();

  return null;
}
