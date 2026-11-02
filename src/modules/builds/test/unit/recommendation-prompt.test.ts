import { describe, expect, it } from 'vitest';
import {
  createChampionDetails,
  testItems,
  testRuneTrees,
} from '../../../../test/fake-providers.js';
import type { HighEloSummary } from '../../../high-elo/high-elo-stats.js';
import {
  buildPrompt,
  buildResponseSchema,
  type RecommendationContext,
} from '../../recommendation-prompt.js';

function createContext(highElo: HighEloSummary | null = null): RecommendationContext {
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
    items: testItems,
    runeTrees: testRuneTrees,
    highElo,
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
      testItems.map((item) => item.id),
    );
    expect(context.arvoresDeRunas[0]).toMatchObject({
      id: '8000',
      nome: 'Precisão',
      runasPrincipais: [{ id: '8005' }, { id: '8010' }],
    });
    expect(context.arvoresDeRunas[0].linhas).toHaveLength(3);
    expect(context.dadosAltoElo).toBeNull();
  });

  it('inclui os dados de alto elo com nomes, taxas e o tamanho da amostra', () => {
    const page = {
      primaryTreeId: '8000',
      keystoneId: '8010',
      primaryRuneIds: ['9111', '9104', '8014'],
      secondaryTreeId: '8100',
      secondaryRuneIds: ['8139', '8135'],
    };
    const context = parseContext(
      buildPrompt(
        createContext({
          matches: 40,
          wins: 22,
          patches: ['16.21'],
          items: [{ itemId: '3031', matches: 30, wins: 18 }],
          keystones: [{ keystoneId: '8010', primaryTreeId: '8000', matches: 40, wins: 22 }],
          runePages: [{ page, matches: 10, wins: 6 }],
          versusEnemies: [
            { championId: '238', laneOpponent: true, matches: 5, wins: 2, items: [] },
          ],
        }),
      ),
    );

    expect(context.dadosAltoElo).toMatchObject({
      partidas: 40,
      taxaDeVitoriaPct: 55,
      amostraConfiavel: true,
      itensMaisUsados: [
        { id: '3031', nome: 'Gume do Infinito', taxaDeUsoPct: 75, taxaDeVitoriaPct: 60 },
      ],
      runasPrincipaisMaisUsadas: [{ nome: 'Conquistador', arvore: 'Precisão', taxaDeUsoPct: 100 }],
      paginasDeRunasMaisUsadas: [
        { runaPrincipal: { nome: 'Conquistador' }, arvoreSecundaria: { nome: 'Dominação' } },
      ],
      contraAdversarios: [
        { adversario: 'Zed', oponenteDireto: true, partidas: 5, amostraConfiavel: false },
      ],
    });
  });
});

describe('buildResponseSchema', () => {
  it('restringe itens, ameaças e runas aos ids informados', () => {
    const schema = buildResponseSchema(['3031', '3006'], ['238', '84'], testRuneTrees);

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
});
