import type { Champion } from './champion.js';

export type CatalogData = {
  version: string;
  champions: Champion[];
};

// Fonte externa dos dados (ex.: Riot Data Dragon). Não faz cache.
export interface ChampionProvider {
  fetchLatestVersion(): Promise<string>;
  fetchCatalog(): Promise<CatalogData>;
}
