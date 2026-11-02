import { beforeAll, describe, it, expect } from 'vitest';
import { RiotChampCatalog } from '../../riot-champion-catalog.js';
import type { Champion } from '../../champion.js';

// Estes testes acessam o Riot Data Dragon de verdade (precisam de internet).
describe('RiotChampCatalog - integration', () => {
  const catalog = new RiotChampCatalog();
  let champions: Champion[];
  let version: string;

  beforeAll(async () => {
    champions = await catalog.getAll();
    version = await catalog.getVersion();
  });

  describe('getAll', () => {
    it('should retrieve champions from Riot Data Dragon', () => {
      expect(champions.length).toBeGreaterThan(0);
    });

    it('should return champions with id, name and icon filled in', () => {
      for (const champion of champions) {
        expect(champion.id).toMatch(/^\d+$/);
        expect(champion.name).not.toBe('');
        expect(champion.icon).not.toBe('');
      }
    });

    it('should not return duplicated ids', () => {
      const ids = champions.map((champion) => champion.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should return names in pt-BR', () => {
      const names = champions.map((champion) => champion.name);

      // em en_US o nome é "Nunu & Willump"
      expect(names).toContain('Nunu e Willump');
    });

    it('should build icon urls with the current version', () => {
      for (const champion of champions) {
        expect(champion.icon).toMatch(
          new RegExp(
            `^https://ddragon\\.leagueoflegends\\.com/cdn/${version.replaceAll('.', '\\.')}/img/champion/\\w+\\.png$`,
          ),
        );
      }
    });
    // reachable -> acessíveis
    it('should return icons that are reachable', async () => {
      const ahri = champions.find((champion) => champion.name === 'Ahri');

      const response = await fetch(ahri!.icon);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/');
    });
  });

  describe('getVersion', () => {
    it('should return the latest game version', () => {
      expect(version).toMatch(/^\d+\.\d+(\.\d+)?$/);
    });
  });

  describe('getById', () => {
    it('should find an existing champion by id', async () => {
      // 103 = Ahri
      const champion = await catalog.getById('103');

      expect(champion).toMatchObject({ id: '103', name: 'Ahri' });
    });

    it('should return the same champion that appears in getAll', async () => {
      const first = champions[0]!;

      await expect(catalog.getById(first.id)).resolves.toEqual(first);
    });

    it('should return undefined for an unknown id', async () => {
      await expect(catalog.getById('999999')).resolves.toBeUndefined();
    });

    it('should return undefined for a name instead of an id', async () => {
      await expect(catalog.getById('Ahri')).resolves.toBeUndefined();
    });
  });

  describe('cache', () => {
    // deve reutilizar o catálogo carregado entre as chamadas
    it('should reuse the loaded catalog across calls', async () => {
      const again = await catalog.getAll();

      expect(again).toBe(champions);
    });

    // deve resolver chamadas simultâneas em uma nova instância com os mesmos dados
    it('should resolve concurrent calls on a fresh instance with the same data', async () => {
      const fresh = new RiotChampCatalog();

      const [all, allAgain, freshVersion] = await Promise.all([
        fresh.getAll(),
        fresh.getAll(),
        fresh.getVersion(),
      ]);

      expect(allAgain).toBe(all);
      expect(all.length).toBeGreaterThan(0);
      expect(freshVersion).toMatch(/^\d+\.\d+(\.\d+)?$/);
    });
  });
});
