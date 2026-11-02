import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../../../test/build-test-app.js';
import {
  createFakeItemProvider,
  createValidAdvisorResponse,
  testItems,
  validMatchupInput as validBody,
} from '../../../../test/fake-providers.js';
import type { BuildAdvisor } from '../../build-advisor.js';

function withEnemies(ids: string[]) {
  return {
    ...validBody,
    enemies: ids.map((championId, index) => ({
      championId,
      lane: validBody.enemies[index % validBody.enemies.length]!.lane,
    })),
  };
}

describe('POST /builds/recommendations', () => {
  let app: FastifyInstance;
  const advisor = { generate: vi.fn() } satisfies BuildAdvisor;

  beforeAll(async () => {
    app = await buildTestApp({
      itemProvider: createFakeItemProvider(testItems),
      buildAdvisor: advisor,
    });
  });

  afterAll(() => app.close());

  function post(payload?: object) {
    return app.inject({ method: 'POST', url: '/builds/recommendations', payload });
  }

  it('responde 200 com a build recomendada para uma entrada válida', async () => {
    advisor.generate.mockResolvedValueOnce(createValidAdvisorResponse());

    const res = await post(validBody);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.champion).toEqual({ id: '1', name: 'Campeão 1', icon: '1.png', lane: 'top' });
    expect(
      body.enemies.map((enemy: { id: string; lane: string }) => [enemy.id, enemy.lane]),
    ).toEqual([
      ['2', 'top'],
      ['3', 'jungle'],
      ['4', 'mid'],
      ['5', 'bot'],
      ['6', 'support'],
    ]);
    expect(body.build).toHaveLength(6);
    expect(body.build[0]).toEqual({
      order: 1,
      id: '3006',
      name: 'Grevas do Berserker',
      icon: '3006.png',
      gold: 1100,
      reason: 'Motivo do item 3006.',
      highEloPickRate: null,
    });
    expect(body.highElo).toBeNull();
    expect(body.purchaseOrder[1]).toBe('Gume do Infinito');
    expect(body.totalGold).toBe(1100 + 3500 + 3000 + 3300 + 3400 + 3200);
    expect(body.threats).toEqual([
      {
        champion: { id: '2', name: 'Campeão 2', icon: '2.png' },
        reason: 'Muito dano físico explosivo.',
      },
    ]);
    expect(body.runes.primary.tree).toEqual({ id: '8000', name: 'Precisão', icon: '8000.png' });
    expect(body.runes.primary.keystone).toEqual({
      id: '8010',
      name: 'Conquistador',
      icon: '8010.png',
      description: 'Efeito de Conquistador.',
    });
    expect(body.runes.primary.runes.map((rune: { id: string }) => rune.id)).toEqual([
      '9111',
      '9104',
      '8014',
    ]);
    expect(body.runes.secondary.tree.name).toBe('Dominação');
    expect(body.runes.secondary.runes.map((rune: { id: string }) => rune.id)).toEqual([
      '8139',
      '8135',
    ]);
    expect(body.runes.reason).toBe('Motivo das runas.');
    expect(body.dataVersion).toBe('9.9.9');
  });

  it('não consulta a IA quando a entrada é inválida', async () => {
    advisor.generate.mockClear();

    const res = await post({ ...validBody, championId: '999' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('CHAMPION_NOT_FOUND');
    expect(advisor.generate).not.toHaveBeenCalled();
  });

  it('responde 502 quando a IA não gera uma recomendação válida', async () => {
    advisor.generate.mockResolvedValue({ items: [] });

    const res = await post(validBody);

    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('RECOMMENDATION_INVALID');
    advisor.generate.mockReset();
  });

  it('responde 400 INVALID_INPUT quando o corpo está ausente', async () => {
    const res = await post();

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_INPUT');
  });

  it('responde 400 INVALID_INPUT quando falta um campo obrigatório', async () => {
    const res = await post({ championId: '1' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_INPUT');
  });

  it('responde 400 INVALID_ENEMY_COUNT quando não são 5 adversários', async () => {
    const res = await post(withEnemies(['2', '3']));

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_ENEMY_COUNT');
  });

  it('responde 400 ENEMIES_DUPLICATED quando há adversários repetidos', async () => {
    const res = await post(withEnemies(['2', '2', '4', '5', '6']));

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ENEMIES_DUPLICATED');
  });

  it('responde 400 PLAYER_CHAMPION_IN_ENEMIES quando o jogador está entre os adversários', async () => {
    const res = await post(withEnemies(['1', '3', '4', '5', '6']));

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('PLAYER_CHAMPION_IN_ENEMIES');
  });

  it('responde 400 ENEMY_LANES_DUPLICATED quando dois adversários estão na mesma rota', async () => {
    const enemies = validBody.enemies.map((enemy) => ({ ...enemy, lane: 'mid' }));
    const res = await post({ ...validBody, enemies });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ENEMY_LANES_DUPLICATED');
  });

  it('responde 400 para JSON malformado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/builds/recommendations',
      headers: { 'content-type': 'application/json' },
      payload: '{ invalido',
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /builds/recommendations sem IA configurada', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({ itemProvider: createFakeItemProvider(testItems) });
  });

  afterAll(() => app.close());

  it('responde 503 AI_NOT_CONFIGURED para uma entrada válida', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/builds/recommendations',
      payload: validBody,
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('AI_NOT_CONFIGURED');
  });
});
