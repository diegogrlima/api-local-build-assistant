import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSample } from '../../match-sample.js';
import { MatchStore } from '../../match-store.js';

const logger = { info: vi.fn(), warn: vi.fn() };

function sample(matchId: string, patch = '16.21', playedAt = 0): MatchSample {
  return { matchId, patch, playedAt, participants: [] };
}

describe('MatchStore', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'match-store-'));
    filePath = join(dir, 'nested', 'matches.json');
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('salva e carrega as partidas do arquivo', async () => {
    const store = new MatchStore({ filePath, logger });
    store.add(sample('BR1_1'));
    store.add(sample('BR1_2'));
    await store.save();

    const reloaded = new MatchStore({ filePath, logger });
    await reloaded.load();

    expect(reloaded.size).toBe(2);
    expect(reloaded.has('BR1_1')).toBe(true);
  });

  it('começa vazio quando o arquivo não existe ou é inválido', async () => {
    const missing = new MatchStore({ filePath, logger });
    await missing.load();
    expect(missing.size).toBe(0);

    const invalidPath = join(dir, 'invalid.json');
    await writeFile(invalidPath, '{"não": "é uma lista"}');
    const invalid = new MatchStore({ filePath: invalidPath, logger });
    await invalid.load();
    expect(invalid.size).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('mantém só os dois patches mais recentes', () => {
    const store = new MatchStore({ logger });
    store.add(sample('a', '16.9'));
    store.add(sample('b', '16.10'));
    store.add(sample('c', '16.11'));

    expect(store.getAll().map((m) => m.matchId)).toEqual(['b', 'c']);
  });

  it('não grava nada quando não há arquivo configurado', async () => {
    const store = new MatchStore({ logger });
    store.add(sample('a'));
    await store.save();

    await expect(readFile(filePath, 'utf8')).rejects.toThrow();
  });
});
