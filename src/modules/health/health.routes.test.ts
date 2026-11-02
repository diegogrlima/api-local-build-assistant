import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../test/build-test-app.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
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
