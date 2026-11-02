import { describe, it, expect, vi, afterEach } from 'vitest';

import { RiotChampCatalog } from '../../riot-champion-catalog.js';

// ==========================================
// FUNÇÕES AUXILIARES (FACTORIES)
// ==========================================

// Cria uma resposta simulada de versões do Data Dragon
function createVersionsMock() {
  return ['16.21.1'];
}

// Cria uma resposta simulada com campeões
function createChampionsMock() {
  return {
    data: {
      Yasuo: {
        key: '157',
        name: 'Yasuo',
        image: { full: 'Yasuo.png' },
      },
      Akshan: {
        key: '166',
        name: 'Akshan',
        image: { full: 'Akshan.png' },
      },
    },
  };
}

// Configura o fetch para devolver as respostas simuladas
function mockFetch(
  versions: unknown = createVersionsMock(),
  champions: unknown = createChampionsMock(),
) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(versions)))
    .mockResolvedValueOnce(new Response(JSON.stringify(champions)));

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

// Limpa os mocks após cada teste
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ==========================================
// TESTES DO RIOT CHAMPION CATALOG
// ==========================================

describe('RiotChampCatalog', () => {
  describe('getAll', () => {
    it('should return a list of all champions', async () => {
      // Arrange
      const versionsMock = createVersionsMock();
      const championsMock = createChampionsMock();

      mockFetch(versionsMock, championsMock);

      const catalog = new RiotChampCatalog();

      // Act
      const result = await catalog.getAll();

      // Assert
      const expected = [
        {
          id: '157',
          name: 'Yasuo',
          icon: `https://ddragon.leagueoflegends.com/cdn/${versionsMock[0]}/img/champion/${championsMock.data.Yasuo.image.full}`,
        },
        {
          id: '166',
          name: 'Akshan',
          icon: `https://ddragon.leagueoflegends.com/cdn/${versionsMock[0]}/img/champion/${championsMock.data.Akshan.image.full}`,
        },
      ];

      expect(result).toHaveLength(2);
      expect(result).toEqual(expected);
    });

    it('should return an empty list of champions', async () => {
      // Arrange
      const versionsMock = createVersionsMock();

      const championsMock = {
        data: {},
      };

      mockFetch(versionsMock, championsMock);

      const catalog = new RiotChampCatalog();

      // Act
      const result = await catalog.getAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should return a champion', async () => {
      const versionsMock = createVersionsMock();
      const championsMock = createChampionsMock();

      mockFetch(versionsMock, championsMock);

      const catalog = new RiotChampCatalog();

      const result = await catalog.getById(championsMock.data.Yasuo.key);

      expect(result).toBeDefined();
      expect(result?.id).toBe('157');
      expect(result?.name).toBe('Yasuo');
      expect(result?.icon).toBe(
        `https://ddragon.leagueoflegends.com/cdn/${versionsMock[0]}/img/champion/${championsMock.data.Yasuo.image.full}`,
      );
    });

    it('should return undefined when the champion is not found', async () => {
      const versionsMock = createVersionsMock();
      const championsMock = createChampionsMock();

      mockFetch(versionsMock, championsMock);

      const catalog = new RiotChampCatalog();

      const result = await catalog.getById('123');

      expect(result).toBeUndefined();
    });
  });

  describe('getVersion', () => {
    it('should return a version', async () => {
      const versionsMock = createVersionsMock();
      const championsMock = createChampionsMock();

      mockFetch(versionsMock, championsMock);

      const catalog = new RiotChampCatalog();

      const result = await catalog.getVersion();

      expect(result).toEqual(versionsMock[0]);
    });

    it('should throw an error when no versions are available', async () => {
      const versionMocks: string[] = [];
      const championsMock = createChampionsMock();

      mockFetch(versionMocks, championsMock);

      const catalog = new RiotChampCatalog();

      await expect(catalog.getVersion()).rejects.toThrow('No versions available from Riot.');
    });

    it('should throw an error when the version response is invalid', async () => {
      const versionsMock = [123];
      const championsMock = createChampionsMock();

      mockFetch(versionsMock, championsMock);

      const catalog = new RiotChampCatalog();

      await expect(catalog.getVersion()).rejects.toThrow();
    });
  });
});
