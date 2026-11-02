export type Logger = {
  info(msg: string): void;
  warn(obj: unknown, msg: string): void;
};

export type VersionedData<T> = {
  version: string;
  entries: T[];
};

// Fonte externa dos dados (ex.: Riot Data Dragon). Não faz cache.
export interface VersionedSource<T> {
  fetchLatestVersion(): Promise<string>;
  fetchData(): Promise<VersionedData<T>>;
}

type Dependencies<T> = {
  source: VersionedSource<T>;
  snapshot: VersionedData<T>;
  logger: Logger;
  // Nome do conteúdo usado nos logs, ex.: "campeões".
  label: string;
};

// Mantém em memória um conjunto de dados versionado, com fallback para o snapshot local
// e atualização periódica quando a versão muda.
export class InMemoryCatalog<T extends { id: string }> {
  private version = '';
  private byId = new Map<string, T>();
  private timer: NodeJS.Timeout | null = null;
  private refreshing = false;

  constructor(private readonly deps: Dependencies<T>) {}

  async init(): Promise<void> {
    try {
      this.apply(await this.deps.source.fetchData());
      this.deps.logger.info(
        `Catálogo de ${this.deps.label} carregado da Riot (versão ${this.version}).`,
      );
    } catch (error) {
      this.deps.logger.warn(
        { err: error },
        `Falha ao carregar ${this.deps.label} da Riot; usando o snapshot local.`,
      );
      this.apply(this.deps.snapshot);
    }
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const latest = await this.deps.source.fetchLatestVersion();
      if (latest === this.version) return;

      this.apply(await this.deps.source.fetchData());
      this.deps.logger.info(
        `Catálogo de ${this.deps.label} atualizado para a versão ${this.version}.`,
      );
    } catch (error) {
      this.deps.logger.warn(
        { err: error },
        `Falha ao atualizar ${this.deps.label}; mantendo o catálogo atual.`,
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

  getAll(): T[] {
    return [...this.byId.values()];
  }

  getById(id: string): T | undefined {
    return this.byId.get(id);
  }

  getVersion(): string {
    return this.version;
  }

  // Monta o Map novo por inteiro e só então troca, para ninguém ler um estado pela metade.
  private apply({ version, entries }: VersionedData<T>): void {
    this.byId = new Map(entries.map((entry) => [entry.id, entry]));
    this.version = version;
  }
}
