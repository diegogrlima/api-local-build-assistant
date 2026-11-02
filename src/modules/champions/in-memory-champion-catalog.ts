import type { ChampionCatalog } from './champion-catalog.js';
import type { Champion } from './champion.js';
import type { CatalogData, ChampionProvider } from './champion-provider.js';

type Logger = {
  info(msg: string): void;
  warn(obj: unknown, msg: string): void;
};

type Dependencies = {
  provider: ChampionProvider;
  snapshot: CatalogData;
  logger: Logger;
};

export class InMemoryChampionCatalog implements ChampionCatalog {
  private version = '';
  private byId = new Map<string, Champion>();
  private timer: NodeJS.Timeout | null = null;
  private refreshing = false;

  constructor(private readonly deps: Dependencies) {}

  async init(): Promise<void> {
    try {
      this.apply(await this.deps.provider.fetchCatalog());
      this.deps.logger.info(`Catálogo de campeões carregado da Riot (versão ${this.version}).`);
    } catch (error) {
      this.deps.logger.warn(
        { err: error },
        'Falha ao carregar campeões da Riot; usando o snapshot local.',
      );
      this.apply(this.deps.snapshot);
    }
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const latest = await this.deps.provider.fetchLatestVersion();
      if (latest === this.version) return;

      this.apply(await this.deps.provider.fetchCatalog());
      this.deps.logger.info(`Catálogo de campeões atualizado para a versão ${this.version}.`);
    } catch (error) {
      this.deps.logger.warn(
        { err: error },
        'Falha ao atualizar campeões; mantendo o catálogo atual.',
      );
    } finally {
      this.refreshing = false;
    }
  }

  startRefresh(intervalMs: number): void {
    if (this.timer) return;

    this.timer = setInterval(() => void this.refresh(), intervalMs);
    this.timer.unref();
  }

  stopRefresh(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
  }

  async getAll(): Promise<Champion[]> {
    return [...this.byId.values()];
  }

  async getById(id: string): Promise<Champion | undefined> {
    return this.byId.get(id);
  }

  async getVersion(): Promise<string> {
    return this.version;
  }

  // Monta o Map novo por inteiro e só então troca, para ninguém ler um estado pela metade.
  private apply({ version, champions }: CatalogData): void {
    this.byId = new Map(champions.map((champion) => [champion.id, champion]));
    this.version = version;
  }
}
