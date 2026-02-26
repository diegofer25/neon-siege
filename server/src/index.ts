import { Elysia } from 'elysia';
import { env } from './config/env';
import { corsPlugin } from './plugins/cors.plugin';
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { leaderboardRoutes } from './routes/leaderboard.routes';
import { wsRoutes } from './ws';

const app = new Elysia()
  .use(corsPlugin)
  .use(healthRoutes)
  .use(authRoutes)
  .use(leaderboardRoutes)
  .use(wsRoutes)
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: 'Validation failed', details: error.message };
    }
    console.error('Unhandled error:', error);
    set.status = 500;
    return { error: 'Internal server error' };
  })
  .listen(env.PORT);

console.log(`Neon Siege server running on http://localhost:${env.PORT}`);
console.log(`Environment: ${env.NODE_ENV}`);
console.log(`WebSocket available at ws://localhost:${env.PORT}/ws`);

export type App = typeof app;
