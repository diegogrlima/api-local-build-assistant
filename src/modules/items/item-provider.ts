import type { Item } from './item.js';

export type ItemCatalogData = {
  version: string;
  items: Item[];
};

// Fonte externa dos itens (ex.: Riot Data Dragon). Não faz cache.
export interface ItemProvider {
  fetchLatestVersion(): Promise<string>;
  fetchCatalog(): Promise<ItemCatalogData>;
}
