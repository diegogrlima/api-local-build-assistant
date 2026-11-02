import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../../app.js';
import { loadEnv } from '../../../../config/env.js';
import type { ChampionProvider } from '../../../champions/champion-provider.js';

const fakeProvider: ChampionProvider = {
  fetchLatestVersion: async () => '9.9.9',
  fetchCatalog: async () => ({
    version: '9.9.9',
    champions: ['1', '2', '3', '4', '5', '6', '7'].map((id) => ({
      id,
      name: `Campeão ${id}`,
      icon: `${id}.png`,
    })),
  }),
};

const validBody = { championId: '1', enemyChampionIds: ['2', '3', '4', '5', '6'] };

describe('POST /builds/recommendations', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadEnv({ NODE_ENV: 'test' }), { championProvider: fakeProvider });
  });

  afterAll(() => app.close());

  function post(payload?: object) {
    return app.inject({ method: 'POST', url: '/builds/recommendations', payload });
  }

  it('aceita a entrada válida e chega até a análise (ainda não implementada)', async () => {
    const res = await post(validBody);

    expect(res.statusCode).toBe(501);
    expect(res.json().code).toBe('RECOMMENDATION_NOT_IMPLEMENTED');
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
    const res = await post({ championId: '1', enemyChampionIds: ['2', '3'] });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_ENEMY_COUNT');
  });

  it('responde 400 CHAMPION_NOT_FOUND quando um campeão não existe', async () => {
    const res = await post({ ...validBody, championId: '999' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('CHAMPION_NOT_FOUND');
  });

  it('responde 400 ENEMIES_DUPLICATED quando há adversários repetidos', async () => {
    const res = await post({ championId: '1', enemyChampionIds: ['2', '2', '4', '5', '6'] });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ENEMIES_DUPLICATED');
  });

  it('responde 400 PLAYER_CHAMPION_IN_ENEMIES quando o jogador está entre os adversários', async () => {
    const res = await post({ championId: '1', enemyChampionIds: ['1', '3', '4', '5', '6'] });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('PLAYER_CHAMPION_IN_ENEMIES');
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
