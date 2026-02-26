import { Elysia } from 'elysia';
import cors from '@elysiajs/cors';
import { env } from '../config/env';

export const corsPlugin = new Elysia({ name: 'cors' }).use(
  cors({
    origin: env.NODE_ENV === 'production' ? /neon-siege\./ : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
