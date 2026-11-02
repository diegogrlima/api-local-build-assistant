import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import type { Env } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';
import type { ChampionProvider } from './modules/champions/champion-provider.js';
import { RiotChampCatalog } from './modules/champions/riot-champion-catalog.js';
import { InMemoryChampionCatalog } from './modules/champions/in-memory-champion-catalog.js';
import { buildsRoutes } from './modules/builds/builds.routes.js';
import { championsRoutes } from './modules/champions/champions.routes.js';
import { loadChampionsSnapshot } from './modules/champions/champions-snapshot.js';
import type { ItemProvider } from './modules/items/item-provider.js';
import { RiotItemProvider } from './modules/items/riot-item-provider.js';
import { InMemoryItemCatalog } from './modules/items/in-memory-item-catalog.js';
import { loadItemsSnapshot } from './modules/items/items-snapshot.js';

type AppDependencies = {
  championProvider?: ChampionProvider;
  itemProvider?: ItemProvider;
};

export async function buildApp(
  env: Env,
  {
    championProvider = new RiotChampCatalog(),
    itemProvider = new RiotItemProvider(),
  }: AppDependencies = {},
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
  const itemCatalog = new InMemoryItemCatalog({
    provider: itemProvider,
    snapshot: loadItemsSnapshot(),
    logger: app.log,
  });
  await Promise.all([championCatalog.init(), itemCatalog.init()]);

  if (env.NODE_ENV !== 'test') {
    championCatalog.startRefresh(env.CATALOG_REFRESH_INTERVAL_MS);
    itemCatalog.startRefresh(env.CATALOG_REFRESH_INTERVAL_MS);
  }
  app.addHook('onClose', async () => {
    championCatalog.stopRefresh();
    itemCatalog.stopRefresh();
  });

  await app.register(healthRoutes);
  await app.register(championsRoutes, { catalog: championCatalog });
  await app.register(buildsRoutes, { catalog: championCatalog });

  return app;
}
