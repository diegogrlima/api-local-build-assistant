import { buildApp, type AppDependencies } from '../app.js';
import { loadEnv } from '../config/env.js';
import {
  createFakeChampionDetailsProvider,
  createFakeChampionProvider,
  createFakeItemProvider,
  createFakeRuneProvider,
} from './fake-providers.js';

// App de teste sem rede: todos os providers são fakes; a IA fica desligada, salvo se injetados.
export function buildTestApp(
  dependencies: AppDependencies = {},
  envOverrides: Record<string, string> = {},
) {
  return buildApp(
    loadEnv({ NODE_ENV: 'test', RECOMMENDATION_RATE_LIMIT_MAX: '1000', ...envOverrides }),
    {
      championProvider: createFakeChampionProvider(),
      championDetailsProvider: createFakeChampionDetailsProvider(),
      itemProvider: createFakeItemProvider(),
      runeProvider: createFakeRuneProvider(),
      buildAdvisor: null,
      ...dependencies,
    },
  );
}
