import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../../app.js';
import { loadEnv } from '../../../../config/env.js';
import type { ChampionProvider } from '../../champion-provider.js';

const fakeProvider: ChampionProvider = {
  fetchLatestVersion: async () => '9.9.9',
  fetchCatalog: async () => ({
    version: '9.9.9',
    champions: [
      { id: '157', name: 'Yasuo', icon: 'yasuo.png' },
      { id: '266', name: 'Aatrox', icon: 'aatrox.png' },
      { id: '103', name: 'Ahri', icon: 'ahri.png' },
    ],
  }),
};

describe('GET /champions', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadEnv({ NODE_ENV: 'test' }), { championProvider: fakeProvider });
  });

  afterAll(() => app.close());

  it('responde 200 com a versão e os campeões', async () => {
    const res = await app.inject({ method: 'GET', url: '/champions' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ version: '9.9.9' });
    expect(res.json().champions).toHaveLength(3);
  });

  it('ordena os campeões por nome', async () => {
    const res = await app.inject({ method: 'GET', url: '/champions' });

    const names = res.json().champions.map((champion: { name: string }) => champion.name);
    expect(names).toEqual(['Aatrox', 'Ahri', 'Yasuo']);
  });

  it('expõe id, name e icon de cada campeão', async () => {
    const res = await app.inject({ method: 'GET', url: '/champions' });

    expect(res.json().champions[0]).toEqual({ id: '266', name: 'Aatrox', icon: 'aatrox.png' });
  });

  it('permite cache no cliente', async () => {
    const res = await app.inject({ method: 'GET', url: '/champions' });

    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });
});
