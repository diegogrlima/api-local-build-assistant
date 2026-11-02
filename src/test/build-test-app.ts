import { buildApp, type AppDependencies } from '../app.js';
import { loadEnv } from '../config/env.js';
import {
  createFakeChampionDetailsProvider,
  createFakeChampionProvider,
  createFakeItemProvider,
  createFakeRuneProvider,
} from './fake-providers.js';

// App de teste sem rede: todos os providers são fakes; a IA e o alto elo ficam desligados, salvo se injetados.
export function buildTestApp(dependencies: AppDependencies = {}) {
  return buildApp(loadEnv({ NODE_ENV: 'test' }), {
    championProvider: createFakeChampionProvider(),
    championDetailsProvider: createFakeChampionDetailsProvider(),
    itemProvider: createFakeItemProvider(),
    runeProvider: createFakeRuneProvider(),
    buildAdvisor: null,
    highEloApi: null,
    ...dependencies,
  });
}
