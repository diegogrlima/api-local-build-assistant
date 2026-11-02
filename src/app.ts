import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import type { Env } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';
import type { ChampionProvider } from './modules/champions/champion-provider.js';
import { RiotChampCatalog } from './modules/champions/riot-champion-catalog.js';
import { InMemoryChampionCatalog } from './modules/champions/in-memory-champion-catalog.js';
import { championsRoutes } from './modules/champions/champions.routes.js';
import { loadChampionsSnapshot } from './modules/champions/champions-snapshot.js';

type AppDependencies = {
  championProvider?: ChampionProvider;
};

export async function buildApp(
  env: Env,
  { championProvider = new RiotChampCatalog() }: AppDependencies = {},
): Promise<FastifyInstance> {
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

  const championCatalog = new InMemoryChampionCatalog({
    provider: championProvider,
    snapshot: loadChampionsSnapshot(),
    logger: app.log,
  });
  await championCatalog.init();

  if (env.NODE_ENV !== 'test') {
    championCatalog.startRefresh(env.CHAMPIONS_REFRESH_INTERVAL_MS);
  }
  app.addHook('onClose', async () => championCatalog.stopRefresh());

  await app.register(healthRoutes);
  await app.register(championsRoutes, { catalog: championCatalog });

  return app;
}
