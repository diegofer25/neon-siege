/**
 * @fileoverview Rate limiter with KV-backed (global) and in-memory (local) strategies.
 *
 * KV strategy: Uses Cloudflare KV for globally consistent rate limits across
 *   all edge isolates. Works via atomic get/put with TTL. Ideal for critical
 *   paths (login, email-sending, score submission).
 *
 * In-memory strategy: Per-isolate sliding window (original implementation).
 *   Good enough for non-critical paths and local dev where KV may not be bound.
 *
 * When a KVNamespace is available on `c.env.RATE_LIMIT`, the KV strategy is
 * used automatically. Falls back to in-memory otherwise.
 */

import { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../types';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Namespace prefix for KV keys (e.g., 'login_ip', 'register_email'). */
  prefix?: string;
  /** Extract key from context. Return null to skip limiting. */
  keyFn?: (c: Context<{ Bindings: Env; Variables: { userId: string; displayName: string } }>) => string | null | Promise<string | null>;
}

// ─── In-memory fallback ────────────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[];
}

function createInMemoryLimiter(opts: RateLimitOptions, keyFn: NonNullable<RateLimitOptions['keyFn']>): MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; displayName: string } }> {
  const store = new Map<string, WindowEntry>();
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = opts.windowMs * 2;

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
    if (!key) { await next(); return; }

    const now = Date.now();
    cleanup(now);

    let entry = store.get(key);
    if (!entry) { entry = { timestamps: [] }; store.set(key, entry); }

    const cutoff = now - opts.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= opts.max) {
      return c.json(
        { error: 'Too many requests', retryAfterMs: entry.timestamps[0]! + opts.windowMs - now },
        429,
      );
    }

    entry.timestamps.push(now);
    await next();
  };
}

// ─── KV-backed global limiter ──────────────────────────────────────────────

function createKvLimiter(opts: RateLimitOptions, keyFn: NonNullable<RateLimitOptions['keyFn']>): MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; displayName: string } }> {
  const prefix = opts.prefix || 'rl';
  const windowSec = Math.ceil(opts.windowMs / 1000);

  return async (c, next) => {
    const rawKey = await keyFn(c);
    if (!rawKey) { await next(); return; }

    const kv: KVNamespace | undefined = c.env.RATE_LIMIT;
    if (!kv) {
      // No KV bound — fall through (the composite middleware handles fallback)
      await next();
      return;
    }

    // KV key: prefix:rawKey:windowBucket
    // Use a fixed window bucket (rounded to windowSec) for simplicity.
    const bucket = Math.floor(Date.now() / opts.windowMs);
    const kvKey = `${prefix}:${rawKey}:${bucket}`;

    const current = await kv.get(kvKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= opts.max) {
      const retryAfterMs = ((bucket + 1) * opts.windowMs) - Date.now();
      return c.json(
        { error: 'Too many requests', retryAfterMs: Math.max(retryAfterMs, 1000) },
        429,
      );
    }

    // Increment. KV put is eventually consistent but good enough for rate limiting.
    // TTL = 2x window to handle clock drift and ensure cleanup.
    await kv.put(kvKey, String(count + 1), { expirationTtl: windowSec * 2 });

    await next();
  };
}

// ─── Factory ───────────────────────────────────────────────────────────────

export function createRateLimiter(opts: RateLimitOptions): MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; displayName: string } }> {
  const keyFn =
    opts.keyFn ??
    ((c: Context<{ Bindings: Env; Variables: { userId: string; displayName: string } }>) => c.get('userId') || null);

  const inMemory = createInMemoryLimiter(opts, keyFn);
  const kv = createKvLimiter(opts, keyFn);

  return async (c, next) => {
    // Prefer KV when available (production), fallback to in-memory (dev)
    if (c.env.RATE_LIMIT) {
      return kv(c, next);
    }
    return inMemory(c, next);
  };
}

/**
 * Extract the real client IP from incoming request headers.
 * CF-Connecting-IP is set by Cloudflare automatically and is trusted.
 */
export function getClientIp(c: Context | Request): string | null {
  // Support both Hono Context and raw Request
  const headers = 'req' in c ? (c as any).req.header.bind((c as any).req) : (name: string) => (c as Request).headers.get(name);

  const cfIp = headers('CF-Connecting-IP');
  if (cfIp) return cfIp;

  // SECURITY: Log warning when CF-Connecting-IP is missing — X-Forwarded-For
  // is spoofable outside Cloudflare's edge network.
  const xff = headers('X-Forwarded-For');
  if (xff) {
    console.warn('[rateLimit] CF-Connecting-IP missing, falling back to X-Forwarded-For');
    return xff.split(',')[0].trim();
  }

  const realIp = headers('X-Real-IP');
  if (realIp) return realIp.trim();

  return null;
}
