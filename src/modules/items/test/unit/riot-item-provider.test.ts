import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isBuildItem,
  isShopItem,
  parseItems,
  RiotItemProvider,
  type RawItem,
} from '../../riot-item-provider.js';

function rawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    name: 'Gume do Infinito',
    description: '<mainText><stats>75 de Dano de Ataque</stats></mainText>',
    plaintext: 'Aprimora drasticamente os acertos críticos',
    from: ['1038', '1037'],
    image: { full: '3031.png' },
    gold: { total: 3500, purchasable: true },
    tags: ['CriticalStrike', 'Damage'],
    maps: { '11': true, '12': true },
    depth: 2,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isBuildItem', () => {
  it('aceita um item completo de Summoner’s Rift', () => {
    expect(isBuildItem('3031', rawItem(), false)).toBe(true);
  });

  it.each<[string, string, Partial<RawItem>]>([
    ['variante de outro modo (id de 6 dígitos)', '663039', {}],
    ['fora de Summoner’s Rift', '3031', { maps: { '11': false, '12': true } }],
    ['não comprável', '3031', { gold: { total: 3500, purchasable: false } }],
    ['fora da loja', '3031', { inStore: false }],
    ['oculto', '3031', { hideFromAll: true }],
    ['exclusivo de um campeão', '3031', { requiredChampion: 'Gangplank' }],
    ['consumível', '2003', { tags: ['Consumable'], consumed: true }],
    ['trinket', '3340', { tags: ['Trinket'] }],
    ['item de suporte', '3869', { tags: ['GoldPer'] }],
    ['item inicial (sem depth)', '1055', { depth: undefined }],
    ['componente que evolui', '3133', { into: ['3071'] }],
  ])('rejeita %s', (_caso, id, overrides) => {
    expect(isBuildItem(id, rawItem(overrides), false)).toBe(false);
  });

  it('aceita botas de tier 2 mesmo que ainda evoluam', () => {
    const boots = rawItem({ name: 'Grevas do Berserker', tags: ['Boots'], into: ['3172'] });

    expect(isBuildItem('3006', boots, true)).toBe(true);
  });
});

describe('isShopItem', () => {
  it('aceita itens iniciais, consumíveis e componentes', () => {
    const potion = rawItem({
      name: 'Poção de Vida',
      tags: ['Consumable'],
      consumed: true,
      depth: undefined,
    });
    const component = rawItem({ name: 'Espada G. p. C.', depth: undefined, into: ['3031'] });

    expect(isShopItem('2003', potion)).toBe(true);
    expect(isShopItem('1038', component)).toBe(true);
  });

  it.each<[string, string, Partial<RawItem>]>([
    ['trinket', '3340', { tags: ['Trinket'] }],
    ['variante de outro modo', '663039', {}],
    ['fora da loja', '1038', { inStore: false }],
    ['exclusivo de um campeão', '3600', { requiredChampion: 'Kalista' }],
  ])('rejeita %s', (_caso, id, overrides) => {
    expect(isShopItem(id, rawItem(overrides))).toBe(false);
  });
});

describe('parseItems', () => {
  it('converte os itens válidos, marca os que não são de build e descarta os inválidos', () => {
    const items = parseItems(
      {
        '3031': rawItem(),
        '2008': { ...rawItem(), name: '' },
        '1055': rawItem({ depth: undefined }),
        '2003': rawItem({
          name: 'Poção de Vida',
          tags: ['Consumable'],
          depth: undefined,
          gold: { total: 50, purchasable: true },
        }),
      },
      '16.21.1',
    );

    // Chaves numéricas são percorridas em ordem crescente.
    expect(items).toEqual([
      expect.objectContaining({ id: '1055', isBuildItem: false }),
      expect.objectContaining({ id: '2003', name: 'Poção de Vida', isBuildItem: false }),
      {
        id: '3031',
        name: 'Gume do Infinito',
        plaintext: 'Aprimora drasticamente os acertos críticos',
        description: '75 de Dano de Ataque',
        gold: 3500,
        tags: ['CriticalStrike', 'Damage'],
        isBoots: false,
        isBuildItem: true,
        from: ['1038', '1037'],
        icon: 'https://ddragon.leagueoflegends.com/cdn/16.21.1/img/item/3031.png',
      },
    ]);
  });

  it('marca como botas os upgrades montados a partir de botas, mesmo sem a tag', () => {
    const items = parseItems(
      {
        '1001': rawItem({ name: 'Botas', tags: ['Boots'], depth: undefined, into: ['3006'] }),
        '3006': rawItem({ name: 'Grevas do Berserker', tags: ['Boots'], from: ['1001'] }),
        '3172': rawItem({ name: 'Grevas Bélicas', tags: ['AttackSpeed'], from: ['3006'] }),
      },
      '16.21.1',
    );

    expect(items.map((item) => [item.id, item.isBoots])).toEqual([
      ['1001', true],
      ['3006', true],
      ['3172', true],
    ]);
  });
});

describe('RiotItemProvider.fetchCatalog', () => {
  it('busca a versão mais recente e os itens em pt_BR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(['16.21.1'])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { '3031': rawItem() } })));
    vi.stubGlobal('fetch', fetchMock);

    const catalog = await new RiotItemProvider().fetchCatalog();

    expect(catalog.version).toBe('16.21.1');
    expect(catalog.items.map((item) => item.id)).toEqual(['3031']);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://ddragon.leagueoflegends.com/cdn/16.21.1/data/pt_BR/item.json',
      expect.anything(),
    );
  });

  it('falha quando a resposta não tem o formato esperado', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(['16.21.1'])))
        .mockResolvedValueOnce(new Response(JSON.stringify({ itens: [] }))),
    );

    await expect(new RiotItemProvider().fetchCatalog()).rejects.toThrow();
  });
});
