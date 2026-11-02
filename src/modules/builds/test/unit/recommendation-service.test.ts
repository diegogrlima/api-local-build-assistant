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
import type { HighEloSummary } from '../../../high-elo/high-elo-stats.js';
import { RecommendationService, type HighEloSource } from '../../recommendation-service.js';

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
  highElo: HighEloSource | null = null,
) {
  return new RecommendationService({
    championCatalog,
    championDetails,
    itemCatalog,
    runeCatalog: runes,
    advisor,
    highElo,
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

  it('consulta os dados de alto elo do campeão na rota e os envia à IA', async () => {
    const summary: HighEloSummary = {
      matches: 50,
      wins: 27,
      patches: ['16.21'],
      items: [
        { itemId: '3031', matches: 40, wins: 22 },
        { itemId: '3006', matches: 25, wins: 14 },
      ],
      keystones: [],
      runePages: [],
      buildPath: {
        matches: 30,
        starterItems: ['1055', '2003', '2003'],
        starterMatches: 20,
        itemSeconds: [540, 900, 1260, 1620, null, null],
      },
      versusEnemies: [],
    };
    const highElo = {
      summarize: vi.fn().mockReturnValue(summary),
      skillOrder: vi.fn().mockReturnValue({
        scope: 'lane',
        matches: 30,
        levels: ['Q', 'E', 'W', 'Q'],
        priority: ['Q', 'E', 'W'],
      }),
    };
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor, allDetails, runeCatalog, highElo).recommend(input);

    const query = highElo.summarize.mock.calls[0]![0];
    expect(query).toMatchObject({ championId: '1', lane: 'top' });
    expect(query.enemies).toContainEqual({ championId: '2', lane: 'top' });
    expect([...query.allowedItemIds]).toEqual(
      testItems.filter((item) => item.isBuildItem).map((item) => item.id),
    );
    expect(advisor.generate.mock.calls[0]![0].prompt).toContain('"dadosAltoElo":{');

    expect(result.highElo).toEqual({
      tiers: ['CHALLENGER', 'GRANDMASTER'],
      patches: ['16.21'],
      matches: 50,
      winRate: 0.54,
      timelineMatches: 30,
    });
    expect(result.build[0]!.highEloPickRate).toBe(0.5);
    expect(result.build[1]!.highEloPickRate).toBe(0.8);
    expect(result.build[2]!.highEloPickRate).toBe(0);
    // O caminho da build usa o tempo de cada posição.
    expect(result.build.map((item) => item.highEloSecond)).toEqual([
      540,
      900,
      1260,
      1620,
      null,
      null,
    ]);
    expect(advisor.generate.mock.calls[0]![0].prompt).toContain('"compraInicialMaisUsada":{');
    expect(highElo.skillOrder).toHaveBeenCalledWith({ championId: '1', lane: 'top' });
    // Com a ordem das partidas, a IA não é consultada sobre ela.
    expect(advisor.generate.mock.calls[0]![0].responseSchema.required).not.toContain(
      'skillPriority',
    );
    // Os 4 níveis das partidas vêm primeiro; os demais são sugeridos pela prioridade.
    expect(result.skillOrder).toEqual({
      source: 'lane',
      levels: 'QEWQQRQEQEREEWWRWW'.split(''),
      observedLevels: 4,
      priority: ['Q', 'E', 'W'],
      spells: spells.map(({ key, name, icon }) => ({ key, name, icon })),
      matches: 30,
      reason: null,
    });
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
    const highElo = { summarize: vi.fn().mockReturnValue(null) };
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    await createService(advisor, allDetails, runeCatalog, highElo).recommend(input);

    const { allowedItemIds, starterItemIds } = highElo.summarize.mock.calls[0]![0];
    expect([...starterItemIds]).toEqual(['1055', '2003', '1101', '3865', '1038', '1036']);
    expect(allowedItemIds.has('1055')).toBe(false);
    const schema = advisor.generate.mock.calls[0]![0].responseSchema;
    expect(schema.properties.items.items.properties.itemId.enum).not.toContain('1055');
  });

  it('segue sem dados de alto elo quando o campeão não tem partidas coletadas', async () => {
    const highElo = { summarize: vi.fn().mockReturnValue(null) };
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor, allDetails, runeCatalog, highElo).recommend(input);

    expect(advisor.generate.mock.calls[0]![0].prompt).toContain('"dadosAltoElo":null');
    expect(result.highElo).toBeNull();
    expect(result.build[0]!.highEloPickRate).toBeNull();
    expect(result.build[0]!.highEloSecond).toBeNull();
    // Sem partidas com a ordem de habilidades, a prioridade vem da IA.
    expect(advisor.generate.mock.calls[0]![0].responseSchema.required).toContain('skillPriority');
    expect(result.skillOrder).toMatchObject({
      source: 'ai',
      levels: 'QEWQQRQEQEREEWWRWW'.split(''),
      observedLevels: 0,
      priority: ['Q', 'E', 'W'],
      reason: 'Q é a principal fonte de dano.',
    });
    // Sem alto elo, a compra inicial ainda vem da IA.
    expect(result.starterItems.map((item) => item.id)).toEqual(['1055', '2003']);
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
    const highElo = {
      summarize: vi.fn().mockReturnValue(null),
      skillOrder: vi.fn().mockReturnValue({
        scope: 'lane',
        matches: 5,
        levels: ['Q', 'W'],
        priority: ['Q', 'W', 'E'],
      }),
    };
    const advisor = { generate: vi.fn().mockResolvedValue(createValidAdvisorResponse()) };

    const result = await createService(advisor, udyr, runeCatalog, highElo).recommend(input);

    expect(result.skillOrder).toMatchObject({ levels: ['Q', 'W'], observedLevels: 2 });
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
