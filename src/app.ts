import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import type { Env } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { InMemoryCatalog, type VersionedSource } from './shared/catalog/in-memory-catalog.js';
import { healthRoutes } from './modules/health/health.routes.js';
import type { ChampionProvider } from './modules/champions/champion-provider.js';
import { RiotChampCatalog } from './modules/champions/riot-champion-catalog.js';
import { InMemoryChampionCatalog } from './modules/champions/in-memory-champion-catalog.js';
import { championsRoutes } from './modules/champions/champions.routes.js';
import { loadChampionsSnapshot } from './modules/champions/champions-snapshot.js';
import type { ChampionDetails } from './modules/champions/champion-details.js';
import { RiotChampionDetailsProvider } from './modules/champions/riot-champion-details-provider.js';
import { loadChampionDetailsSnapshot } from './modules/champions/champion-details-snapshot.js';
import type { ItemProvider } from './modules/items/item-provider.js';
import { RiotItemProvider } from './modules/items/riot-item-provider.js';
import { InMemoryItemCatalog } from './modules/items/in-memory-item-catalog.js';
import { loadItemsSnapshot } from './modules/items/items-snapshot.js';
import type { RuneTree } from './modules/runes/rune.js';
import { RiotRuneProvider } from './modules/runes/riot-rune-provider.js';
import { loadRunesSnapshot } from './modules/runes/runes-snapshot.js';
import type { BuildAdvisor } from './modules/builds/build-advisor.js';
import { GeminiBuildAdvisor } from './modules/builds/gemini-build-advisor.js';
import { RecommendationService } from './modules/builds/recommendation-service.js';
import { buildsRoutes } from './modules/builds/builds.routes.js';
import { RiotApiClient } from './shared/riot-api/riot-api-client.js';
import { RiotHighEloApi, type HighEloApi } from './modules/high-elo/high-elo-api.js';
import { MatchStore } from './modules/high-elo/match-store.js';
import { HighEloCollector } from './modules/high-elo/high-elo-collector.js';
import { summarizeHighElo, summarizeSkillOrder } from './modules/high-elo/high-elo-stats.js';

export type AppDependencies = {
  championProvider?: ChampionProvider;
  championDetailsProvider?: VersionedSource<ChampionDetails>;
  itemProvider?: ItemProvider;
  runeProvider?: VersionedSource<RuneTree>;
  // null desliga a IA; sem valor, usa o Gemini quando GEMINI_API_KEY estiver definida.
  buildAdvisor?: BuildAdvisor | null;
  // null desliga os dados de alto elo; sem valor, usa a API da Riot quando RIOT_API_KEY estiver definida.
  highEloApi?: HighEloApi | null;
};

function createDefaultAdvisor(env: Env): BuildAdvisor | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GeminiBuildAdvisor({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
}

function createDefaultHighEloApi(env: Env): HighEloApi | null {
  if (!env.RIOT_API_KEY) return null;
  return new RiotHighEloApi(new RiotApiClient({ apiKey: env.RIOT_API_KEY }), env.RIOT_PLATFORM);
}

export async function buildApp(
  env: Env,
  {
    championProvider = new RiotChampCatalog(),
    championDetailsProvider = new RiotChampionDetailsProvider(),
    itemProvider = new RiotItemProvider(),
    runeProvider = new RiotRuneProvider(),
    buildAdvisor = createDefaultAdvisor(env),
    highEloApi = createDefaultHighEloApi(env),
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

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(sensible);
  registerErrorHandler(app);

  const championCatalog = new InMemoryChampionCatalog({
    provider: championProvider,
    snapshot: loadChampionsSnapshot(),
    logger: app.log,
  });
  const championDetails = new InMemoryCatalog({
    source: championDetailsProvider,
    snapshot: loadChampionDetailsSnapshot(),
    logger: app.log,
    label: 'detalhes de campeões',
  });
  const itemCatalog = new InMemoryItemCatalog({
    provider: itemProvider,
    snapshot: loadItemsSnapshot(),
    logger: app.log,
  });
  const runeCatalog = new InMemoryCatalog({
    source: runeProvider,
    snapshot: loadRunesSnapshot(),
    logger: app.log,
    label: 'runas',
  });
  const catalogs = [championCatalog, championDetails, itemCatalog, runeCatalog];
  await Promise.all(catalogs.map((catalog) => catalog.init()));

  if (env.NODE_ENV !== 'test') {
    for (const catalog of catalogs) catalog.startRefresh(env.CATALOG_REFRESH_INTERVAL_MS);
  }
  app.addHook('onClose', async () => {
    for (const catalog of catalogs) catalog.stopRefresh();
  });

  // Partidas de alto elo: o arquivo só é usado fora dos testes, e a coleta roda em segundo plano.
  const matchStore = new MatchStore({
    filePath: env.NODE_ENV === 'test' ? undefined : env.HIGH_ELO_DATA_FILE,
    logger: app.log,
  });
  if (highEloApi) {
    await matchStore.load();
    const collector = new HighEloCollector({ api: highEloApi, store: matchStore, logger: app.log });
    if (env.NODE_ENV !== 'test') collector.start(env.HIGH_ELO_REFRESH_INTERVAL_MS);
    app.addHook('onClose', () => collector.stop());
  } else {
    app.log.warn('RIOT_API_KEY não definida: a recomendação não usará dados de alto elo.');
  }

  if (!buildAdvisor) {
    app.log.warn('GEMINI_API_KEY não definida: a recomendação de build ficará indisponível.');
  }
  const recommendationService = new RecommendationService({
    championCatalog,
    championDetails,
    itemCatalog,
    runeCatalog,
    advisor: buildAdvisor,
    highElo: highEloApi && {
      summarize: (query) => summarizeHighElo(matchStore.getAll(), query),
      skillOrder: (query) => summarizeSkillOrder(matchStore.getAll(), query),
    },
  });

  await app.register(healthRoutes);
  await app.register(championsRoutes, { catalog: championCatalog });
  await app.register(buildsRoutes, { recommendationService });

  return app;
}
