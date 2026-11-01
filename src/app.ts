import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import type { Env } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
            transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
          },
  });

  await app.register(sensible);
  registerErrorHandler(app);

  await app.register(healthRoutes);

  return app;
}
