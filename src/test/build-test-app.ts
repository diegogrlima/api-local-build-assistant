import { buildApp, type AppDependencies } from '../app.js';
import { loadEnv } from '../config/env.js';
import {
  createFakeChampionDetailsProvider,
  createFakeChampionProvider,
  createFakeItemProvider,
} from './fake-providers.js';

// App de teste sem rede: todos os providers são fakes e a IA fica desligada, salvo se injetada.
export function buildTestApp(dependencies: AppDependencies = {}) {
  return buildApp(loadEnv({ NODE_ENV: 'test' }), {
    championProvider: createFakeChampionProvider(),
    championDetailsProvider: createFakeChampionDetailsProvider(),
    itemProvider: createFakeItemProvider(),
    buildAdvisor: null,
    ...dependencies,
  });
}
