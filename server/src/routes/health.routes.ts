import { Elysia } from 'elysia';
import { testConnection } from '../config/database';

export const healthRoutes = new Elysia({ prefix: '/api' })
  .get('/health', async () => {
    const dbOk = await testConnection();
    return {
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  });
