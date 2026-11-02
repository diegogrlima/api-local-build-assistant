import { InMemoryCatalog, type Logger } from '../../shared/catalog/in-memory-catalog.js';
import type { ItemCatalog } from './item-catalog.js';
import type { Item } from './item.js';
import type { ItemCatalogData, ItemProvider } from './item-provider.js';

type Dependencies = {
  provider: ItemProvider;
  snapshot: ItemCatalogData;
  logger: Logger;
};

export class InMemoryItemCatalog implements ItemCatalog {
  private readonly catalog: InMemoryCatalog<Item>;

  constructor({ provider, snapshot, logger }: Dependencies) {
    this.catalog = new InMemoryCatalog({
      source: {
        fetchLatestVersion: () => provider.fetchLatestVersion(),
        fetchData: async () => {
          const { version, items } = await provider.fetchCatalog();
          return { version, entries: items };
        },
      },
      snapshot: { version: snapshot.version, entries: snapshot.items },
      logger,
      label: 'itens',
    });
  }

  init(): Promise<void> {
    return this.catalog.init();
  }

  refresh(): Promise<void> {
    return this.catalog.refresh();
  }

  startRefresh(intervalMs: number): void {
    this.catalog.startRefresh(intervalMs);
  }

  stopRefresh(): void {
    this.catalog.stopRefresh();
  }

  async getAll(): Promise<Item[]> {
    return this.catalog.getAll();
  }

  async getById(id: string): Promise<Item | undefined> {
    return this.catalog.getById(id);
  }

  async getVersion(): Promise<string> {
    return this.catalog.getVersion();
  }
}
