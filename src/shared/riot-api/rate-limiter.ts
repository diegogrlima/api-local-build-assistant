export type RateLimit = { requests: number; windowMs: number };

// Limites da chave pessoal da Riot, aplicados por região (host).
export const PERSONAL_KEY_LIMITS: RateLimit[] = [
  { requests: 20, windowMs: 1_000 },
  { requests: 100, windowMs: 120_000 },
];

export type Clock = {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal!.reason);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    }),
};

// Janela deslizante: cada chamada espera até caber em todos os limites ao mesmo tempo.
export class RateLimiter {
  private timestamps: number[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly limits: RateLimit[] = PERSONAL_KEY_LIMITS,
    private readonly clock: Clock = systemClock,
  ) {}

  // As chamadas são enfileiradas para que duas não ocupem a mesma vaga.
  acquire(signal?: AbortSignal): Promise<void> {
    const turn = this.queue.then(() => this.waitForSlot(signal));
    this.queue = turn.catch(() => undefined);
    return turn;
  }

  private async waitForSlot(signal?: AbortSignal): Promise<void> {
    for (;;) {
      const now = this.clock.now();
      const longest = Math.max(...this.limits.map((limit) => limit.windowMs));
      this.timestamps = this.timestamps.filter((time) => now - time < longest);

      const waits = this.limits.map(({ requests, windowMs }) => {
        const inWindow = this.timestamps.filter((time) => now - time < windowMs);
        return inWindow.length < requests
          ? 0
          : inWindow[inWindow.length - requests]! + windowMs - now;
      });
      const wait = Math.max(...waits);
      if (wait <= 0) {
        this.timestamps.push(now);
        return;
      }
      await this.clock.sleep(wait, signal);
    }
  }
}
