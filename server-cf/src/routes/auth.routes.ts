/**
 * @fileoverview Auth routes — Cloudflare Workers / Hono port.
 *
 * Replaces Elysia's `.resolve()`, `t.Object()`, and cookie plugin with
 * Hono middleware, manual validation, and `hono/cookie`.
 */

import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { Env, AppVariables } from '../types';
import { signJwt, verifyJwt } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { getClientIp } from '../middleware/rateLimit';
import * as authService from '../services/auth.service';
import * as UserModel from '../models/user.model';

type AuthEnv = { Bindings: Env; Variables: AppVariables };

export const authRoutes = new Hono<AuthEnv>();

// ─── Token helpers ───────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

async function issueTokens(
  c: any,
  user: { id: string; display_name: string },
) {
  const accessToken = await signJwt(
    { sub: user.id, displayName: user.display_name },
    c.env.JWT_SECRET,
    ACCESS_TOKEN_TTL,
  );
  const refreshTokenValue = await signJwt(
    { sub: user.id },
    c.env.JWT_REFRESH_SECRET,
    REFRESH_TOKEN_TTL,
  );

  setCookie(c, 'refreshToken', refreshTokenValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: REFRESH_TOKEN_TTL,
    path: '/',
  });

  return { accessToken, user: UserModel.toPublicUser(user as any) };
}

// ─── Rate limiters ───────────────────────────────────────────────────────────

const forgotIpLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 5,
  keyFn: (c) => getClientIp(c),
});

const forgotEmailLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 3,
  keyFn: async (c) => {
    try {
      const body = await c.req.json();
      return body?.email ? String(body.email).trim().toLowerCase() : null;
    } catch {
      return null;
    }
  },
});

const resetPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 10,
  keyFn: (c) => getClientIp(c),
});

const registerStartIpLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 5,
  keyFn: (c) => getClientIp(c),
});

const registerStartEmailLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 5,
  keyFn: async (c) => {
    try {
      const body = await c.req.json();
      return body?.email ? String(body.email).trim().toLowerCase() : null;
    } catch {
      return null;
    }
  },
});

const registerVerifyLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 20,
  keyFn: (c) => getClientIp(c),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

authRoutes.post('/register', registerStartIpLimiter, registerStartEmailLimiter, async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; displayName?: string }>();
  if (!body.email || !body.password || !body.displayName) {
    return c.json({ error: 'email, password, and displayName are required' }, 400);
  }
  if (body.password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  try {
    await authService.startEmailRegistration(c.env.DB, c.env, body.email, body.password, body.displayName);
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

authRoutes.post('/register/verify', registerVerifyLimiter, async (c) => {
  const body = await c.req.json<{ email?: string; code?: string }>();
  if (!body.email || !body.code) {
    return c.json({ error: 'email and code are required' }, 400);
  }

  try {
    const user = await authService.verifyEmailRegistration(c.env.DB, body.email, body.code);
    const result = await issueTokens(c, user);
    return c.json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  if (!body.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  try {
    const user = await authService.loginWithEmail(c.env.DB, body.email, body.password);
    const result = await issueTokens(c, user);
    return c.json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

authRoutes.post('/google', async (c) => {
  const body = await c.req.json<{ idToken?: string }>();
  if (!body.idToken) {
    return c.json({ error: 'idToken is required' }, 400);
  }

  try {
    const user = await authService.loginWithGoogle(c.env.DB, body.idToken, c.env.GOOGLE_CLIENT_ID);
    const result = await issueTokens(c, user);
    return c.json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

authRoutes.post('/anonymous/resume', async (c) => {
  const body = await c.req.json<{ deviceId?: string }>();
  if (!body.deviceId || body.deviceId.length < 10 || body.deviceId.length > 128) {
    return c.json({ error: 'deviceId must be 10-128 characters' }, 400);
  }

  try {
    const user = await authService.resumeAnonymous(c.env.DB, body.deviceId);
    const result = await issueTokens(c, user);
    return c.json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

authRoutes.post('/anonymous', async (c) => {
  const body = await c.req.json<{ displayName?: string; deviceId?: string }>();
  if (!body.displayName || !body.deviceId) {
    return c.json({ error: 'displayName and deviceId are required' }, 400);
  }

  try {
    const user = await authService.createAnonymous(c.env.DB, body.displayName, body.deviceId);
    const result = await issueTokens(c, user);
    return c.json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});

authRoutes.post('/refresh', async (c) => {
  const token = getCookie(c, 'refreshToken');
  if (!token) {
    return c.json({ error: 'No refresh token' }, 401);
  }

  const payload = await verifyJwt(token, c.env.JWT_REFRESH_SECRET);
  if (!payload?.sub) {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  const user = await UserModel.findById(c.env.DB, payload.sub);
  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  const result = await issueTokens(c, user);
  return c.json(result);
});

authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'refreshToken', { path: '/' });
  return c.json({ success: true });
});

// ─── Password reset ──────────────────────────────────────────────────────────

authRoutes.post('/forgot-password', forgotIpLimiter, forgotEmailLimiter, async (c) => {
  const body = await c.req.json<{ email?: string }>();
  if (!body.email) {
    return c.json({ error: 'email is required' }, 400);
  }

  // Always return ok to prevent user enumeration
  try {
    await authService.requestPasswordReset(c.env.DB, c.env, body.email);
  } catch {
    // Swallow
  }
  return c.json({ ok: true });
});

authRoutes.post('/reset-password', resetPasswordLimiter, async (c) => {
  const body = await c.req.json<{ token?: string; newPassword?: string }>();
  if (!body.token || !body.newPassword) {
    return c.json({ error: 'token and newPassword are required' }, 400);
  }
  if (body.newPassword.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  try {
    const user = await authService.resetPassword(c.env.DB, body.token, body.newPassword);
    const result = await issueTokens(c, user);
    return c.json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    throw err;
  }
});
