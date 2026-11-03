import { describe, expect, it } from 'vitest';
import {
  createChampionDetails,
  testItems,
  testRuneTrees,
} from '../../../../test/fake-providers.js';
import {
  buildPrompt,
  buildResponseSchema,
  type RecommendationContext,
} from '../../recommendation-prompt.js';
import { starterCandidates } from '../../starter-items.js';

function createContext(): RecommendationContext {
  return {
    champion: {
      ...createChampionDetails({ id: '157', name: 'Yasuo', allyTips: ['Dica aliada'] }),
      lane: 'mid',
    },
    enemies: [
      {
        ...createChampionDetails({ id: '238', name: 'Zed', enemyTips: ['Dica contra'] }),
        lane: 'mid',
      },
      { ...createChampionDetails({ id: '64', name: 'Lee Sin' }), lane: 'jungle' },
    ],
    items: testItems.filter((item) => item.isBuildItem),
    starterItems: starterCandidates(testItems),
    runeTrees: testRuneTrees,
  };
}

function parseContext(prompt: string) {
  return JSON.parse(prompt.slice(prompt.indexOf('{')));
}

describe('buildPrompt', () => {
  it('inclui o campeão, os adversários, as rotas, a análise, os itens e as runas', () => {
    const prompt = buildPrompt(createContext());

    const context = parseContext(prompt);
    expect(context.campeaoDoJogador).toMatchObject({
      id: '157',
      nome: 'Yasuo',
      rota: 'Meio',
      dicas: ['Dica aliada'],
    });
    expect(context.oponenteDireto).toBe('Zed');
    expect(context.adversarios[0]).toMatchObject({
      nome: 'Zed',
      rota: 'Meio',
      dicasContra: ['Dica contra'],
    });
    expect(context.adversarios[1].rota).toBe('Selva');
    expect(context.analiseDaComposicaoInimiga.damage).toBeDefined();
    expect(context.itensPermitidos.map((item: { id: string }) => item.id)).toEqual(
      testItems.filter((item) => item.isBuildItem).map((item) => item.id),
    );
    expect(context.itensIniciaisPermitidos).toContainEqual(
      expect.objectContaining({ id: '1101', companheiroDaSelva: true, itemDeSuporte: false }),
    );
    expect(context.arvoresDeRunas[0]).toMatchObject({
      id: '8000',
      nome: 'Precisão',
      runasPrincipais: [{ id: '8005' }, { id: '8010' }],
    });
    expect(context.arvoresDeRunas[0].linhas).toHaveLength(3);
    expect(context).not.toHaveProperty('dadosAltoElo');
  });
});

describe('buildResponseSchema', () => {
  it('restringe itens, ameaças e runas aos ids informados', () => {
    const schema = buildResponseSchema(['3031', '3006'], ['238', '84'], testRuneTrees, [
      '1055',
      '2003',
    ]);

    expect(schema.properties.starter.properties.itemIds.items.enum).toEqual(['1055', '2003']);

    expect(schema.properties.items.items.properties.itemId.enum).toEqual(['3031', '3006']);
    expect(schema.properties.threats.items.properties.championId.enum).toEqual(['238', '84']);
    expect(schema.properties.items.minItems).toBe(6);
    expect(schema.properties.items.maxItems).toBe(6);

    const runes = schema.properties.runes.properties;
    expect(runes.primaryTreeId.enum).toEqual(['8000', '8100']);
    expect(runes.keystoneId.enum).toEqual(['8005', '8010', '8112']);
    expect(runes.primaryRuneIds.items.enum).not.toContain('8010');
    expect(runes.primaryRuneIds.minItems).toBe(3);
    expect(runes.secondaryRuneIds.maxItems).toBe(2);
  });

  it('sempre pede a prioridade de habilidades à IA', () => {
    const schema = buildResponseSchema(['3031'], ['238'], testRuneTrees, ['1055']);

    expect(schema.required).toContain('skillPriority');
    expect(schema.properties.skillPriority.properties.order.items.enum).toEqual(['Q', 'W', 'E']);
  });
});
