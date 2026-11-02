import { InMemoryCatalog, type Logger } from '../../shared/catalog/in-memory-catalog.js';
import type { ChampionCatalog } from './champion-catalog.js';
import type { Champion } from './champion.js';
import type { CatalogData, ChampionProvider } from './champion-provider.js';

type Dependencies = {
  provider: ChampionProvider;
  snapshot: CatalogData;
  logger: Logger;
};

export class InMemoryChampionCatalog implements ChampionCatalog {
  private readonly catalog: InMemoryCatalog<Champion>;

  constructor({ provider, snapshot, logger }: Dependencies) {
    this.catalog = new InMemoryCatalog({
      source: {
        fetchLatestVersion: () => provider.fetchLatestVersion(),
        fetchData: async () => {
          const { version, champions } = await provider.fetchCatalog();
          return { version, entries: champions };
        },
      },
      snapshot: { version: snapshot.version, entries: snapshot.champions },
      logger,
      label: 'campeões',
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

  async getAll(): Promise<Champion[]> {
    return this.catalog.getAll();
  }

  async getById(id: string): Promise<Champion | undefined> {
    return this.catalog.getById(id);
  }

  async getVersion(): Promise<string> {
    return this.catalog.getVersion();
  }
}
