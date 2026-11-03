import { describe, expect, it, vi } from 'vitest';
import type { AppError } from '../../../../shared/errors/app-error.js';
import {
  createChampionDetails,
  createValidAdvisorResponse,
  createValidRunes,
  testChampions,
  testItems,
  testRuneTrees,
  validMatchupInput as input,
} from '../../../../test/fake-providers.js';
import type { ChampionCatalog } from '../../../champions/champion-catalog.js';
import type { ItemCatalog } from '../../../items/item-catalog.js';
import type { BuildAdvisor } from '../../build-advisor.js';
import { RecommendationService } from '../../recommendation-service.js';

const championCatalog: ChampionCatalog = {
  getAll: async () => testChampions,
  getById: async (id) => testChampions.find((champion) => champion.id === id),
  getVersion: async () => '9.9.9',
};

const itemCatalog: ItemCatalog = {
  getAll: async () => testItems,
  getById: async (id) => testItems.find((item) => item.id === id),
  getVersion: async () => '9.9.9',
};

// Habilidades com os pontos padrão (5/5/5/3), que permitem completar a ordem até o nível 18.
const spells = (['Q', 'W', 'E', 'R'] as const).map((key) => ({
  key,
  name: `Habilidade ${key}`,
  description: '',
  icon: `${key}.png`,
  maxRank: key === 'R' ? 3 : 5,
}));

const allDetails = {
  getById: (id: string) => {
    const champion = testChampions.find((c) => c.id === id);
    return champion && createChampionDetails({ id: champion.id, name: champion.name, spells });
  },
};

const runeCatalog = { getAll: () => testRuneTrees };

function createService(
  advisor: BuildAdvisor | null,
  championDetails = allDetails,
  runes = runeCatalog,
) {
  return new RecommendationService({
    championCatalog,
    championDetails,
    itemCatalog,
    runeCatalog: runes,
    advisor,
  });
}

async function errorFrom(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Era esperado que a recomendação falhasse.');
}

describe('RecommendationService', () => {
  it('devolve a recomendação quando a IA responde de forma válida', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor).recommend(input);

    expect(result.build.map((item) => item.id)).toEqual([
      '3006',
      '3031',
      '3033',
      '3036',
      '3072',
      '3026',
    ]);
    expect(result.champion.lane).toBe('top');
    expect(result.runes.primary.keystone.name).toBe('Conquistador');
    expect(advisor.generate).toHaveBeenCalledOnce();
  });

  it('monta a ordem de habilidades a partir da prioridade escolhida pela IA', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor).recommend(input);

    expect(advisor.generate.mock.calls[0]![0].responseSchema.required).toContain('skillPriority');
    expect(result.skillOrder).toEqual({
      levels: 'QEWQQRQEQEREEWWRWW'.split(''),
      priority: ['Q', 'E', 'W'],
      spells: spells.map(({ key, name, icon }) => ({ key, name, icon })),
      reason: 'Q é a principal fonte de dano.',
    });
    expect(result.starterItems.map((item) => item.id)).toEqual(['1055', '2003']);
  });

  it('devolve a compra inicial escolhida pela IA, agrupando os itens repetidos', async () => {
    const response = {
      ...createValidAdvisorResponse(),
      starter: { itemIds: ['1036', '2003', '2003'], reason: 'Troca de dano na rota.' },
    };
    const advisor = { generate: vi.fn().mockResolvedValue(response) };

    const result = await createService(advisor).recommend(input);

    expect(result.starterItems).toEqual([
      { id: '1036', name: 'Espada Longa', icon: '1036.png', count: 1 },
      { id: '2003', name: 'Poção de Vida', icon: '2003.png', count: 2 },
    ]);
    expect(result.starterReason).toBe('Troca de dano na rota.');
    const schema = advisor.generate.mock.calls[0]![0].responseSchema;
    expect(schema.properties.starter.properties.itemIds.items.enum).toEqual([
      '1055',
      '2003',
      '1101',
      '3865',
      '1036',
    ]);
  });

  it('pede nova resposta quando a compra inicial de quem joga na selva não tem companheiro', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };
    const jungleInput = {
      ...input,
      lane: 'jungle',
      enemies: input.enemies.map((enemy) =>
        enemy.lane === 'jungle'
          ? { ...enemy, lane: 'top' }
          : enemy.lane === 'top'
            ? { ...enemy, lane: 'jungle' }
            : enemy,
      ),
    };

    expect((await errorFrom(createService(advisor).recommend(jungleInput))).statusCode).toBe(502);

    expect(advisor.generate).toHaveBeenCalledTimes(2);
    expect(advisor.generate.mock.calls[1]![0].prompt).toContain(
      'exatamente 1 companheiro da selva',
    );
  });

  it('não oferece itens iniciais nem componentes entre os itens da build', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    await createService(advisor).recommend(input);

    const schema = advisor.generate.mock.calls[0]![0].responseSchema;
    expect(schema.properties.items.items.properties.itemId.enum).not.toContain('1055');
  });

  it('não completa a ordem de campeões com pontos de habilidade próprios', async () => {
    const udyr = {
      getById: (id: string) => {
        const champion = testChampions.find((c) => c.id === id)!;
        return createChampionDetails({
          id: champion.id,
          name: champion.name,
          spells: spells.map((spell) => ({ ...spell, maxRank: 6 })),
        });
      },
    };
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor, udyr, runeCatalog).recommend(input);

    expect(result.skillOrder).toMatchObject({ levels: [], priority: ['Q', 'E', 'W'] });
  });

  it('lista os componentes de cada item, do mais barato ao mais caro', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor).recommend(input);

    expect(result.build[1]!.components).toEqual([
      { id: '1036', name: 'Espada Longa', icon: '1036.png', gold: 350, count: 2 },
      { id: '1038', name: 'Espada G. p. C.', icon: '1038.png', gold: 1300, count: 1 },
    ]);
    expect(result.build[0]!.components).toEqual([]);
  });

  it('devolve as runas menores na ordem das linhas da árvore', async () => {
    const response = {
      ...createValidAdvisorResponse(),
      runes: { ...createValidRunes(), primaryRuneIds: ['8014', '9111', '9104'] },
    };
    const advisor = { generate: vi.fn().mockResolvedValue(response) };

    const result = await createService(advisor).recommend(input);

    expect(result.runes.primary.runes.map((rune) => rune.id)).toEqual(['9111', '9104', '8014']);
  });

  it('envia à IA as instruções, o contexto e o schema restrito', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    await createService(advisor).recommend(input);

    const request = advisor.generate.mock.calls[0]![0];
    expect(request.systemInstruction).toContain('Não invente dados');
    expect(request.prompt).toContain('Campeão 2');
    expect(request.prompt).toContain('"oponenteDireto":"Campeão 2"');
    expect(request.prompt).toContain('"rota":"Topo"');
    expect(request.responseSchema.properties.runes.properties.primaryTreeId.enum).toEqual([
      '8000',
      '8100',
    ]);
    expect(request.responseSchema.properties.threats.items.properties.championId.enum).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
  });

  it('tenta de novo, informando os problemas, quando a primeira resposta é inválida', async () => {
    const invalid = {
      ...createValidAdvisorResponse(),
      items: createValidAdvisorResponse().items.map((item, index) =>
        index === 5 ? { ...item, itemId: '9999' } : item,
      ),
    };
    const advisor = {
      generate: vi
        .fn()
        .mockResolvedValueOnce(invalid)
        .mockResolvedValueOnce(createValidAdvisorResponse()),
    };

    const result = await createService(advisor).recommend(input);

    expect(result.build).toHaveLength(6);
    expect(advisor.generate).toHaveBeenCalledTimes(2);
    expect(advisor.generate.mock.calls[1]![0].prompt).toContain(
      'Itens fora da lista permitida: 9999.',
    );
  });

  it('falha com 502 quando a IA erra duas vezes', async () => {
    const advisor = { generate: vi.fn().mockResolvedValue('não é json') };

    const error = await errorFrom(createService(advisor).recommend(input));

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('RECOMMENDATION_INVALID');
    expect(advisor.generate).toHaveBeenCalledTimes(2);
  });

  it('valida a entrada antes de verificar se a IA está configurada', async () => {
    const error = await errorFrom(createService(null).recommend({ championId: '1' }));

    expect(error.code).toBe('INVALID_INPUT');
  });

  it('falha com 503 quando a IA não está configurada', async () => {
    const error = await errorFrom(createService(null).recommend(input));

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('sinaliza falta de informação quando não há detalhes de algum campeão', async () => {
    const advisor = { generate: vi.fn() };
    const withoutChampion3 = {
      getById: (id: string) => (id === '3' ? undefined : allDetails.getById(id)),
    };

    const error = await errorFrom(createService(advisor, withoutChampion3).recommend(input));

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('CHAMPION_DATA_UNAVAILABLE');
    expect(error.message).toContain('Campeão 3');
    expect(advisor.generate).not.toHaveBeenCalled();
  });

  it('sinaliza falta de informação quando não há runas', async () => {
    const advisor = { generate: vi.fn() };

    const error = await errorFrom(
      createService(advisor, allDetails, { getAll: () => [] }).recommend(input),
    );

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('RUNE_DATA_UNAVAILABLE');
    expect(advisor.generate).not.toHaveBeenCalled();
  });
});
