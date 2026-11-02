import { RateLimiter, systemClock, type Clock } from './rate-limiter.js';

const TIMEOUT_MS = 10_000;
// Tentativas extras após um 429 ou uma falha temporária (5xx).
const MAX_RETRIES = 3;
const DEFAULT_RETRY_AFTER_S = 10;

type Options = {
  apiKey: string;
  clock?: Clock;
  fetchFn?: typeof fetch;
  createLimiter?: () => RateLimiter;
};

// Cliente da API oficial da Riot. Respeita os limites por região e repete após 429.
export class RiotApiClient {
  private readonly limiters = new Map<string, RateLimiter>();
  private readonly clock: Clock;
  private readonly fetchFn: typeof fetch;
  private readonly createLimiter: () => RateLimiter;

  constructor(private readonly options: Options) {
    this.clock = options.clock ?? systemClock;
    this.fetchFn = options.fetchFn ?? fetch;
    this.createLimiter = options.createLimiter ?? (() => new RateLimiter(undefined, this.clock));
  }

  async get(host: string, path: string, signal?: AbortSignal): Promise<unknown> {
    const url = `${host}${path}`;

    for (let attempt = 0; ; attempt++) {
      await this.limiterFor(host).acquire(signal);

      let response: Response;
      try {
        response = await this.fetchFn(url, {
          headers: { 'X-Riot-Token': this.options.apiKey },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
            : AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new Error(`Network failure when accessing ${url}`, { cause: error });
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get('Retry-After')) || DEFAULT_RETRY_AFTER_S;
        await this.clock.sleep(retryAfter * 1000, signal);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} when accessing ${url}`);
      }

      try {
        return await response.json();
      } catch (error) {
        throw new Error(`Invalid JSON response from ${url}`, { cause: error });
      }
    }
  }

  private limiterFor(host: string): RateLimiter {
    let limiter = this.limiters.get(host);
    if (!limiter) {
      limiter = this.createLimiter();
      this.limiters.set(host, limiter);
    }
    return limiter;
  }
}
