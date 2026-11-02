import { describe, expect, it } from 'vitest';
import { createChampionDetails, testItems } from '../../../../test/fake-providers.js';
import { buildPrompt, buildResponseSchema } from '../../recommendation-prompt.js';

describe('buildPrompt', () => {
  it('inclui o campeão, os adversários, a análise e os itens permitidos', () => {
    const prompt = buildPrompt({
      champion: createChampionDetails({ id: '157', name: 'Yasuo', allyTips: ['Dica aliada'] }),
      enemies: [createChampionDetails({ id: '238', name: 'Zed', enemyTips: ['Dica contra'] })],
      items: testItems,
    });

    const context = JSON.parse(prompt.slice(prompt.indexOf('{')));
    expect(context.campeaoDoJogador).toMatchObject({
      id: '157',
      nome: 'Yasuo',
      dicas: ['Dica aliada'],
    });
    expect(context.adversarios[0]).toMatchObject({ nome: 'Zed', dicasContra: ['Dica contra'] });
    expect(context.analiseDaComposicaoInimiga.damage).toBeDefined();
    expect(context.itensPermitidos.map((item: { id: string }) => item.id)).toEqual(
      testItems.map((item) => item.id),
    );
  });
});

describe('buildResponseSchema', () => {
  it('restringe itens e ameaças aos ids informados', () => {
    const schema = buildResponseSchema(['3031', '3006'], ['238', '84']);

    expect(schema.properties.items.items.properties.itemId.enum).toEqual(['3031', '3006']);
    expect(schema.properties.threats.items.properties.championId.enum).toEqual(['238', '84']);
    expect(schema.properties.items.minItems).toBe(6);
    expect(schema.properties.items.maxItems).toBe(6);
  });
});
