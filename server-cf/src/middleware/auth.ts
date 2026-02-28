/**
 * @fileoverview JWT auth middleware for Hono on Cloudflare Workers.
 *
 * Provides `requireAuth` and `optionalAuth` middleware that populate
 * `c.set('userId', ...)` and `c.set('displayName', ...)`.
 *
 * Uses Web Crypto HMAC-SHA256 for JWT signing/verification (same algorithm
 * as the old Elysia JWT plugin).
 */

import { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../types';

// ─── JWT Helpers (Web Crypto) ──────────────────────────────────────────────────

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface JwtPayload {
  sub: string;
  displayName?: string;
  exp?: number;
  iat?: number;
}

export async function signJwt(
  payload: JwtPayload,
  secret: string,
  expiresIn: number, // seconds
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload & { iat: number; exp: number } = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(body)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const key = await hmacKey(secret);
    const sig = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sig,
      new TextEncoder().encode(signingInput),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64)),
    ) as JwtPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ─── Hono Middleware ───────────────────────────────────────────────────────────

/**
 * Require a valid Bearer access token. Sets userId + displayName on context.
 * Returns 401 on missing/invalid token.
 */
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; displayName: string } }> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload?.sub) {
    return c.json({ error: 'Invalid or expired access token' }, 401);
  }

  c.set('userId', payload.sub);
  c.set('displayName', (payload.displayName as string) ?? '');
  await next();
};

/**
 * Optionally parse a Bearer token. Sets userId/displayName to empty string if absent.
 */
export const optionalAuth: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string; displayName: string } }> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (payload?.sub) {
      c.set('userId', payload.sub);
      c.set('displayName', (payload.displayName as string) ?? '');
      await next();
      return;
    }
  }

  c.set('userId', '');
  c.set('displayName', '');
  await next();
};
