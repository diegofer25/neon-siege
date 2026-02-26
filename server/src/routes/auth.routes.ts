import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';
import { requireAuth } from '../middleware/authenticate';
import * as authService from '../services/auth.service';
import * as UserModel from '../models/user.model';

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
    '/anonymous',
    async ({ body, accessJwt, refreshJwt, cookie: { refreshToken } }) => {
      const user = await authService.createAnonymous(body.displayName);

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
    },
    {
      body: t.Object({
        displayName: t.String({ minLength: 1, maxLength: 50 }),
      }),
    }
  )

  .post(
    '/refresh',
    async ({ accessJwt, refreshJwt, cookie: { refreshToken }, set }) => {
      const token = refreshToken.value;
      if (!token) {
        set.status = 401;
        return { error: 'No refresh token' };
      }

      const payload = await refreshJwt.verify(token);
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
  });
