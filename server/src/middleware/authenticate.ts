import { Elysia } from 'elysia';
import { authPlugin } from '../plugins/auth.plugin';

export const requireAuth = new Elysia({ name: 'requireAuth' })
  .use(authPlugin)
  .derive(async ({ accessJwt, headers, set }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      set.status = 401;
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const payload = await accessJwt.verify(token);

    if (!payload) {
      set.status = 401;
      throw new Error('Invalid or expired access token');
    }

    return {
      userId: payload.sub as string,
      displayName: payload.displayName as string,
    };
  });

export const optionalAuth = new Elysia({ name: 'optionalAuth' })
  .use(authPlugin)
  .derive(async ({ accessJwt, headers }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { userId: null, displayName: null };
    }

    const token = authHeader.slice(7);
    const payload = await accessJwt.verify(token);

    if (!payload) {
      return { userId: null, displayName: null };
    }

    return {
      userId: payload.sub as string,
      displayName: payload.displayName as string,
    };
  });
