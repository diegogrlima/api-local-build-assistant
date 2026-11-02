import type { Logger } from '../../shared/catalog/in-memory-catalog.js';
import type { HighEloApi } from './high-elo-api.js';
import type { MatchStore } from './match-store.js';
import { parseMatch } from './riot-match-parser.js';

// Com a chave pessoal (100 chamadas a cada 2 minutos), um ciclo leva alguns minutos.
// A cada ciclo, a coleta avança para os próximos jogadores da lista.
export const PLAYERS_PER_CYCLE = 40;
export const MATCHES_PER_PLAYER = 10;
const SAVE_EVERY = 25;

type Dependencies = {
  api: HighEloApi;
  store: MatchStore;
  logger: Logger;
};

// Coleta em segundo plano as partidas ranqueadas de Challenger e Grão-Mestre.
export class HighEloCollector {
  private cursor = 0;
  // Partidas descartadas pelo parser (outra fila, remake...), para não buscá-las de novo.
  private readonly skipped = new Set<string>();
  private running: Promise<void> | null = null;
  private controller = new AbortController();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: Dependencies) {}

  collect(): Promise<void> {
    this.running ??= this.runCycle(this.controller.signal).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  start(intervalMs: number): void {
    if (this.timer) return;

    void this.collect();
    this.timer = setInterval(() => void this.collect(), intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.controller.abort();
    await this.running;
    this.controller = new AbortController();
  }

  private async runCycle(signal: AbortSignal): Promise<void> {
    const { api, store, logger } = this.deps;
    let added = 0;

    try {
      const players = await api.fetchHighEloPlayers(signal);
      if (players.length === 0) return;

      const batch = Array.from(
        { length: Math.min(PLAYERS_PER_CYCLE, players.length) },
        (_, index) => players[(this.cursor + index) % players.length]!,
      );
      this.cursor = (this.cursor + batch.length) % players.length;

      for (const puuid of batch) {
        let matchIds: string[];
        try {
          matchIds = await api.fetchRankedMatchIds(puuid, MATCHES_PER_PLAYER, signal);
        } catch (error) {
          if (signal.aborted) throw error;
          logger.warn({ err: error }, 'Falha ao buscar as partidas de um jogador de alto elo.');
          continue;
        }

        for (const matchId of matchIds) {
          if (store.has(matchId) || this.skipped.has(matchId)) continue;

          try {
            const sample = parseMatch(await api.fetchMatch(matchId, signal));
            if (!sample) {
              this.skipped.add(matchId);
              continue;
            }
            store.add(sample);
            if (++added % SAVE_EVERY === 0) await store.save();
          } catch (error) {
            if (signal.aborted) throw error;
            logger.warn({ err: error }, `Falha ao buscar a partida ${matchId}.`);
          }
        }
      }

      logger.info(`Coleta de alto elo: ${added} partidas novas, ${store.size} no total.`);
    } catch (error) {
      if (!signal.aborted) {
        logger.warn({ err: error }, 'Falha na coleta de partidas de alto elo.');
      }
    } finally {
      // O progresso parcial também é salvo, inclusive ao desligar o servidor.
      if (added > 0) {
        await store.save().catch((error: unknown) => {
          logger.warn({ err: error }, 'Falha ao salvar as partidas de alto elo.');
        });
      }
    }
  }
}
