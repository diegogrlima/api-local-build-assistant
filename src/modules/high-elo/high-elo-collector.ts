import type { Logger } from '../../shared/catalog/in-memory-catalog.js';
import type { HighEloApi } from './high-elo-api.js';
import type { MatchSample } from './match-sample.js';
import type { MatchStore } from './match-store.js';
import { parseMatch } from './riot-match-parser.js';
import { addPurchaseTimeline } from './riot-timeline-parser.js';

// Com a chave pessoal (100 chamadas a cada 2 minutos), um ciclo leva alguns minutos
// (duas chamadas por partida nova: a partida e a linha do tempo dela).
// A cada ciclo, a coleta avança para os próximos jogadores da lista.
export const PLAYERS_PER_CYCLE = 40;
export const MATCHES_PER_PLAYER = 10;
// Partidas já guardadas que ganham a linha do tempo a cada ciclo.
export const BACKFILL_PER_CYCLE = 40;
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
  // Partidas guardadas cuja linha do tempo não pôde ser obtida, para não tentar a cada ciclo.
  private readonly withoutTimeline = new Set<string>();
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

  // Sem a linha do tempo, a partida ainda vale para itens e runas; só fica sem os tempos de compra.
  private async withTimeline(sample: MatchSample, signal: AbortSignal): Promise<MatchSample> {
    try {
      return addPurchaseTimeline(
        sample,
        await this.deps.api.fetchMatchTimeline(sample.matchId, signal),
      );
    } catch (error) {
      if (signal.aborted) throw error;
      this.deps.logger.warn(
        { err: error },
        `Falha ao buscar a linha do tempo da partida ${sample.matchId}.`,
      );
      return sample;
    }
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
            store.add(await this.withTimeline(sample, signal));
            if (++added % SAVE_EVERY === 0) await store.save();
          } catch (error) {
            if (signal.aborted) throw error;
            logger.warn({ err: error }, `Falha ao buscar a partida ${matchId}.`);
          }
        }
      }

      // Completa as partidas guardadas antes da linha do tempo; só conta as que a obtiveram.
      let completed = 0;
      for (const sample of store.withoutTimeline(BACKFILL_PER_CYCLE, this.withoutTimeline)) {
        const updated = await this.withTimeline(sample, signal);
        if (updated === sample) {
          this.withoutTimeline.add(sample.matchId);
          continue;
        }
        store.add(updated);
        completed++;
        if (++added % SAVE_EVERY === 0) await store.save();
      }

      logger.info(
        `Coleta de alto elo: ${added - completed} partidas novas, ${completed} completadas com a linha do tempo, ${store.size} no total.`,
      );
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
