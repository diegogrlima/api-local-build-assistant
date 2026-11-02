import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Logger } from '../../shared/catalog/in-memory-catalog.js';
import { matchSampleSchema, type MatchSample } from './match-sample.js';

// Só os patches mais recentes representam o jogo atual.
const MAX_PATCHES = 2;
const MAX_MATCHES = 20_000;

type Options = {
  // Sem arquivo, as partidas ficam só em memória (ex.: testes).
  filePath?: string;
  logger: Logger;
};

function comparePatches(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split('.').map(Number);
  const [bMajor = 0, bMinor = 0] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}

// Partidas de alto elo já coletadas, guardadas em um arquivo JSON entre reinícios.
export class MatchStore {
  private matches = new Map<string, MatchSample>();

  constructor(private readonly options: Options) {}

  async load(): Promise<void> {
    const { filePath, logger } = this.options;
    if (!filePath) return;

    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      logger.info('Nenhuma partida de alto elo salva ainda; a coleta começa do zero.');
      return;
    }

    try {
      const samples = z.array(matchSampleSchema).parse(JSON.parse(content));
      this.matches = new Map(samples.map((sample) => [sample.matchId, sample]));
      this.prune();
      logger.info(`${this.matches.size} partidas de alto elo carregadas de ${filePath}.`);
    } catch (error) {
      logger.warn({ err: error }, `Arquivo ${filePath} inválido; a coleta começa do zero.`);
    }
  }

  // Grava em um arquivo temporário e renomeia, para nunca deixar o JSON pela metade.
  async save(): Promise<void> {
    const { filePath } = this.options;
    if (!filePath) return;

    await mkdir(dirname(filePath), { recursive: true });
    const temp = `${filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.getAll()));
    await rename(temp, filePath);
  }

  has(matchId: string): boolean {
    return this.matches.has(matchId);
  }

  add(sample: MatchSample): void {
    this.matches.set(sample.matchId, sample);
    this.prune();
  }

  // Partidas mais recentes ainda sem a linha do tempo completa (coletadas antes dela ou da ordem
  // das habilidades), para a coleta completar aos poucos.
  withoutTimeline(limit: number, skip: ReadonlySet<string> = new Set()): MatchSample[] {
    return [...this.matches.values()]
      .filter((match) => !skip.has(match.matchId))
      .filter((match) => match.participants.some((p) => p.timeline?.skillOrder === undefined))
      .sort((a, b) => b.playedAt - a.playedAt)
      .slice(0, limit);
  }

  getAll(): MatchSample[] {
    return [...this.matches.values()];
  }

  get size(): number {
    return this.matches.size;
  }

  private prune(): void {
    const patches = [...new Set([...this.matches.values()].map((m) => m.patch))]
      .sort(comparePatches)
      .slice(-MAX_PATCHES);

    const kept = [...this.matches.values()]
      .filter((match) => patches.includes(match.patch))
      .sort((a, b) => b.playedAt - a.playedAt)
      .slice(0, MAX_MATCHES);

    if (kept.length !== this.matches.size) {
      this.matches = new Map(kept.map((match) => [match.matchId, match]));
    }
  }
}
