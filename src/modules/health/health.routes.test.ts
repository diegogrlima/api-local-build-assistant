import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import type { ChampionProvider } from '../champions/champion-provider.js';
import { loadEnv } from '../../config/env.js';

const fakeProvider: ChampionProvider = {
  fetchLatestVersion: async () => '1.0.0',
  fetchCatalog: async () => ({ version: '1.0.0', champions: [] }),
};

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadEnv({ NODE_ENV: 'test' }), { championProvider: fakeProvider });
  });

  afterAll(() => app.close());

  it('responde 200 com status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('responde 404 em rota inexistente', async () => {
    const res = await app.inject({ method: 'GET', url: '/nao-existe' });
    expect(res.statusCode).toBe(404);
  });
});
