import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';

export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'accessJwt',
      secret: env.JWT_SECRET,
      exp: '15m',
    })
  )
  .use(
    jwt({
      name: 'refreshJwt',
      secret: env.JWT_REFRESH_SECRET,
      exp: '7d',
    })
  );
