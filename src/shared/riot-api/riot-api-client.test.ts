import { describe, expect, it, vi } from 'vitest';
import { RateLimiter, type Clock } from './rate-limiter.js';
import { RiotApiClient } from './riot-api-client.js';

// Relógio falso: dormir só avança o tempo.
function createClock(): Clock & { sleeps: number[] } {
  let now = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

describe('RateLimiter', () => {
  it('espera quando algum dos limites é atingido', async () => {
    const clock = createClock();
    const limiter = new RateLimiter(
      [
        { requests: 2, windowMs: 1_000 },
        { requests: 3, windowMs: 10_000 },
      ],
      clock,
    );

    for (let i = 0; i < 4; i++) await limiter.acquire();

    // A 3ª chamada espera a janela de 1 s; a 4ª espera a janela de 10 s.
    expect(clock.sleeps).toEqual([1_000, 9_000]);
    expect(clock.now()).toBe(10_000);
  });
});

describe('RiotApiClient', () => {
  function response(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), { status, headers });
  }

  it('envia a chave no cabeçalho e devolve o JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(200, { ok: true }));
    const client = new RiotApiClient({ apiKey: 'chave', clock: createClock(), fetchFn });

    await expect(client.get('https://br1.api.riotgames.com', '/lol/x')).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://br1.api.riotgames.com/lol/x');
    expect(init.headers).toEqual({ 'X-Riot-Token': 'chave' });
  });

  it('respeita o Retry-After de um 429 e tenta de novo', async () => {
    const clock = createClock();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(429, {}, { 'Retry-After': '3' }))
      .mockResolvedValueOnce(response(200, ['BR1_1']));
    const client = new RiotApiClient({ apiKey: 'chave', clock, fetchFn });

    await expect(client.get('https://americas.api.riotgames.com', '/ids')).resolves.toEqual([
      'BR1_1',
    ]);
    expect(clock.sleeps).toContain(3_000);
  });

  it('falha com o status quando a resposta não é de sucesso', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(403));
    const client = new RiotApiClient({ apiKey: 'chave', clock: createClock(), fetchFn });

    await expect(client.get('https://br1.api.riotgames.com', '/lol/x')).rejects.toThrow(
      /HTTP error 403/,
    );
  });
});
