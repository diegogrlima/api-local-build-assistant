import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../../../test/build-test-app.js';
import { createFakeChampionProvider } from '../../../../test/fake-providers.js';

const fakeProvider = createFakeChampionProvider([
  { id: '157', name: 'Yasuo', icon: 'yasuo.png' },
  { id: '266', name: 'Aatrox', icon: 'aatrox.png' },
  { id: '103', name: 'Ahri', icon: 'ahri.png' },
]);

describe('GET /champions', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({ championProvider: fakeProvider });
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
