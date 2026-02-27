/**
 * @fileoverview Simple in-memory sliding-window rate limiter for Elysia.
 *
 * Usage:
 *   import { createRateLimiter } from '../middleware/rateLimit';
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10, keyFn: ctx => ctx.userId });
 *   app.onBeforeHandle(limiter);
 *
 * Limits are per-key (usually userId).  Expired entries are lazily cleaned up.
 */

interface RateLimitOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed in the window */
  max: number;
  /** Extract a key from the request context (e.g. userId, IP). Defaults to userId. */
  keyFn?: (ctx: any) => string | null;
}

interface WindowEntry {
  timestamps: number[];
}

/**
 * Create a rate-limit guard function for an Elysia beforeHandle hook.
 */
export function createRateLimiter(opts: RateLimitOptions) {
  const store = new Map<string, WindowEntry>();
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = opts.windowMs * 2;
  const keyFn = opts.keyFn ?? ((ctx: any) => ctx.userId as string | null);

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    const cutoff = now - opts.windowMs;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }

  return function rateLimitGuard(ctx: any) {
    const key = keyFn(ctx);
    if (!key) return; // no key → skip (unauthenticated, handled elsewhere)

    const now = Date.now();
    cleanup(now);

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    const cutoff = now - opts.windowMs;
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);

    if (entry.timestamps.length >= opts.max) {
      ctx.set.status = 429;
      return {
        error: 'Too many requests',
        retryAfterMs: entry.timestamps[0]! + opts.windowMs - now,
      };
    }

    entry.timestamps.push(now);
  };
}

/**
 * Extract the real client IP from a request context.
 * Reads x-forwarded-for first (set by reverse proxies / CDNs), falls back to
 * the raw socket address provided by Bun/Elysia.
 */
export function getClientIp(ctx: any): string | null {
  const xff = (ctx.request as Request | undefined)?.headers?.get?.('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (ctx.server?.requestIP?.(ctx.request as Request))?.address ?? null;
}
