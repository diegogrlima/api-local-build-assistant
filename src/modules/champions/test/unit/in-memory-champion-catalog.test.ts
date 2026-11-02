import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryChampionCatalog } from '../../in-memory-champion-catalog.js';
import type { CatalogData, ChampionProvider } from '../../champion-provider.js';

const snapshot: CatalogData = {
  version: '1.0.0',
  champions: [{ id: '1', name: 'Annie', icon: 'annie.png' }],
};

const riotData: CatalogData = {
  version: '2.0.0',
  champions: [
    { id: '157', name: 'Yasuo', icon: 'yasuo.png' },
    { id: '166', name: 'Akshan', icon: 'akshan.png' },
  ],
};

function createProvider(overrides: Partial<ChampionProvider> = {}) {
  return {
    fetchLatestVersion: vi.fn().mockResolvedValue(riotData.version),
    fetchCatalog: vi.fn().mockResolvedValue(riotData),
    ...overrides,
  } satisfies ChampionProvider;
}

function createCatalog(provider: ChampionProvider) {
  const logger = { info: vi.fn(), warn: vi.fn() };
  const catalog = new InMemoryChampionCatalog({ provider, snapshot, logger });
  return { catalog, logger };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('InMemoryChampionCatalog', () => {
  describe('init', () => {
    it('carrega os dados do provider quando ele responde', async () => {
      const { catalog } = createCatalog(createProvider());

      await catalog.init();

      expect(await catalog.getVersion()).toBe('2.0.0');
      expect(await catalog.getById('157')).toEqual(riotData.champions[0]);
    });

    it('cai no snapshot quando o provider falha', async () => {
      const provider = createProvider({
        fetchCatalog: vi.fn().mockRejectedValue(new Error('Riot fora do ar')),
      });
      const { catalog, logger } = createCatalog(provider);

      await catalog.init();

      expect(await catalog.getVersion()).toBe('1.0.0');
      expect(await catalog.getAll()).toEqual(snapshot.champions);
      expect(await catalog.getById('1')).toEqual(snapshot.champions[0]);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('retorna undefined para id inexistente', async () => {
      const { catalog } = createCatalog(createProvider());
      await catalog.init();

      expect(await catalog.getById('999')).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('recarrega quando a versão mudou', async () => {
      const provider = createProvider({
        fetchLatestVersion: vi.fn().mockResolvedValue('3.0.0'),
        fetchCatalog: vi
          .fn()
          .mockResolvedValueOnce(riotData)
          .mockResolvedValueOnce({ version: '3.0.0', champions: snapshot.champions }),
      });
      const { catalog } = createCatalog(provider);
      await catalog.init();

      await catalog.refresh();

      expect(await catalog.getVersion()).toBe('3.0.0');
      expect(await catalog.getAll()).toEqual(snapshot.champions);
    });

    it('não recarrega quando a versão é a mesma', async () => {
      const provider = createProvider();
      const { catalog } = createCatalog(provider);
      await catalog.init();

      await catalog.refresh();

      expect(provider.fetchCatalog).toHaveBeenCalledTimes(1);
    });

    it('mantém os dados anteriores quando o refresh falha', async () => {
      const provider = createProvider({
        fetchLatestVersion: vi.fn().mockRejectedValue(new Error('Riot fora do ar')),
      });
      const { catalog, logger } = createCatalog(provider);
      await catalog.init();

      await catalog.refresh();

      expect(await catalog.getVersion()).toBe('2.0.0');
      expect(await catalog.getAll()).toEqual(riotData.champions);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('mantém os dados quando a versão mudou mas o download falha', async () => {
      const provider = createProvider({
        fetchLatestVersion: vi.fn().mockResolvedValue('3.0.0'),
        fetchCatalog: vi
          .fn()
          .mockResolvedValueOnce(riotData)
          .mockRejectedValueOnce(new Error('HTTP 500')),
      });
      const { catalog } = createCatalog(provider);
      await catalog.init();

      await catalog.refresh();

      expect(await catalog.getVersion()).toBe('2.0.0');
      expect(await catalog.getAll()).toEqual(riotData.champions);
    });
  });

  describe('startRefresh / stopRefresh', () => {
    it('executa o refresh a cada intervalo e para após stopRefresh', async () => {
      vi.useFakeTimers();
      const provider = createProvider();
      const { catalog } = createCatalog(provider);
      await catalog.init();

      catalog.startRefresh(1000);
      await vi.advanceTimersByTimeAsync(3000);
      expect(provider.fetchLatestVersion).toHaveBeenCalledTimes(3);

      catalog.stopRefresh();
      await vi.advanceTimersByTimeAsync(3000);
      expect(provider.fetchLatestVersion).toHaveBeenCalledTimes(3);
    });
  });
});
