import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import { requireAuth } from '../middleware/authenticate';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit';
import * as authService from '../services/auth.service';
import * as UserModel from '../models/user.model';

// ─── Abuse-prevention rate limiters for unauthenticated password-reset routes ─

/** Max 5 forgot-password requests per IP per 15 minutes */
const forgotIpLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 5,
  keyFn: getClientIp,
});

/** Max 3 emails to the same address per hour (prevents inbox bombing) */
const forgotEmailLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 3,
  keyFn: (ctx: any) => (ctx.body?.email as string | undefined)?.toLowerCase() ?? null,
});

/** Max 10 reset-password attempts per IP per hour (brute-force guard) */
const resetPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 10,
  keyFn: getClientIp,
});

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(authPlugin)

  .post(
    '/register',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      try {
        const user = await authService.registerWithEmail(body.email, body.password, body.displayName);

        const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
        const refresh = await refreshJwt.sign({ sub: user.id });

        refreshToken.set({
          value: refresh,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return { accessToken, user };
      } catch (err) {
        if (err instanceof authService.AuthError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        displayName: t.String({ minLength: 1, maxLength: 50 }),
      }),
    }
  )

  .post(
    '/login',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      try {
        const user = await authService.loginWithEmail(body.email, body.password);

        const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
        const refresh = await refreshJwt.sign({ sub: user.id });

        refreshToken.set({
          value: refresh,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return { accessToken, user };
      } catch (err) {
        if (err instanceof authService.AuthError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
      }),
    }
  )

  .post(
    '/google',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      try {
        const user = await authService.loginWithGoogle(body.idToken);

        const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
        const refresh = await refreshJwt.sign({ sub: user.id });

        refreshToken.set({
          value: refresh,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return { accessToken, user };
      } catch (err) {
        if (err instanceof authService.AuthError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        idToken: t.String(),
      }),
    }
  )

  .post(
    '/anonymous/resume',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      try {
        const user = await authService.resumeAnonymous(body.deviceId);

        const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
        const refresh = await refreshJwt.sign({ sub: user.id });

        refreshToken.set({
          value: refresh,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return { accessToken, user };
      } catch (err) {
        if (err instanceof authService.AuthError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        deviceId: t.String({ minLength: 10, maxLength: 128 }),
      }),
    }
  )

  .post(
    '/anonymous',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      try {
        const user = await authService.createAnonymous(body.displayName, body.deviceId);

        const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
        const refresh = await refreshJwt.sign({ sub: user.id });

        refreshToken.set({
          value: refresh,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return { accessToken, user };
      } catch (err) {
        if (err instanceof authService.AuthError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        displayName: t.String({ minLength: 1, maxLength: 50 }),
        deviceId: t.String({ minLength: 10, maxLength: 128 }),
      }),
    }
  )

  .post(
    '/refresh',
    async ({ accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      const token = refreshToken.value;
      if (!token || typeof token !== 'string') {
        set.status = 401;
        return { error: 'No refresh token' };
      }

      const payload = await refreshJwt.verify(token as string);
      if (!payload) {
        set.status = 401;
        return { error: 'Invalid refresh token' };
      }

      const user = await UserModel.findById(payload.sub as string);
      if (!user) {
        set.status = 401;
        return { error: 'User not found' };
      }

      // Rotate refresh token
      const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
      const newRefresh = await refreshJwt.sign({ sub: user.id });

      refreshToken.set({
        value: newRefresh,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return { accessToken, user: UserModel.toPublicUser(user) };
    }
  )

  .post('/logout', ({ cookie: { refreshToken } }) => {
    refreshToken.remove();
    return { success: true };
  })

  // ─── Password reset ───────────────────────────────────────────────────────

  .post(
    '/forgot-password',
    async ({ body }) => {
      // Always return { ok: true } regardless of whether the email exists
      // to prevent user-enumeration attacks.
      try {
        await authService.requestPasswordReset(body.email);
      } catch {
        // Swallow errors — do not leak info
      }
      return { ok: true };
    },
    {
      body: t.Object({ email: t.String({ format: 'email' }) }),
      beforeHandle: [forgotIpLimiter, forgotEmailLimiter],
    }
  )

  .post(
    '/reset-password',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      try {
        const user = await authService.resetPassword(body.token, body.newPassword);

        // Auto-login: issue a fresh session after password reset
        const accessToken = await accessJwt.sign({ sub: user.id, displayName: user.display_name });
        const refresh = await refreshJwt.sign({ sub: user.id });

        refreshToken.set({
          value: refresh,
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return { accessToken, user };
      } catch (err) {
        if (err instanceof authService.AuthError) {
          set.status = err.statusCode;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        token: t.String(),
        newPassword: t.String({ minLength: 6 }),
      }),
      beforeHandle: [resetPasswordLimiter],
    }
  );
