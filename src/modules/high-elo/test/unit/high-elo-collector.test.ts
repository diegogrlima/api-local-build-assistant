import { describe, expect, it, vi } from 'vitest';
import type { HighEloApi } from '../../high-elo-api.js';
import {
  HighEloCollector,
  MATCHES_PER_PLAYER,
  PLAYERS_PER_CYCLE,
} from '../../high-elo-collector.js';
import { MatchStore } from '../../match-store.js';
import { parseMatch } from '../../riot-match-parser.js';

const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

// Partida mínima aceita pelo parser.
function rawMatch(matchId: string, queueId = 420) {
  return {
    metadata: { matchId },
    info: {
      gameVersion: '16.21.1',
      gameCreation: 0,
      gameDuration: 1800,
      queueId,
      participants: Array.from({ length: 10 }, (_, index) => ({
        championId: index + 1,
        teamPosition: POSITIONS[index % 5],
        teamId: index < 5 ? 100 : 200,
        win: index < 5,
        item0: 3031,
        item1: 0,
        item2: 0,
        item3: 0,
        item4: 0,
        item5: 0,
        perks: {
          styles: [
            {
              description: 'primaryStyle',
              style: 8000,
              selections: [{ perk: 8010 }, { perk: 9111 }, { perk: 9104 }, { perk: 8014 }],
            },
            { description: 'subStyle', style: 8100, selections: [{ perk: 8139 }, { perk: 8135 }] },
          ],
        },
      })),
    },
  };
}

// Participante 1 compra a Lâmina de Doran no início e o Gume do Infinito aos 15 minutos.
const rawTimeline = {
  info: {
    frames: [
      { events: [{ type: 'ITEM_PURCHASED', timestamp: 5_000, participantId: 1, itemId: 1055 }] },
      { events: [{ type: 'ITEM_PURCHASED', timestamp: 900_000, participantId: 1, itemId: 3031 }] },
    ],
  },
};

function createApi(overrides: Partial<HighEloApi> = {}) {
  return {
    fetchHighEloPlayers: vi.fn().mockResolvedValue(['p1', 'p2']),
    fetchRankedMatchIds: vi.fn(async (puuid: string) => [`${puuid}_m1`, 'shared']),
    fetchMatch: vi.fn(async (matchId: string) => rawMatch(matchId)),
    fetchMatchTimeline: vi.fn(async () => rawTimeline),
    ...overrides,
  };
}

const logger = { info: vi.fn(), warn: vi.fn() };

describe('HighEloCollector', () => {
  it('guarda as partidas dos jogadores de alto elo sem buscar a mesma duas vezes', async () => {
    const api = createApi();
    const store = new MatchStore({ logger });

    await new HighEloCollector({ api, store, logger }).collect();

    expect(api.fetchRankedMatchIds).toHaveBeenCalledWith(
      'p1',
      MATCHES_PER_PLAYER,
      expect.anything(),
    );
    expect(api.fetchMatch).toHaveBeenCalledTimes(3);
    expect(
      store
        .getAll()
        .map((m) => m.matchId)
        .sort(),
    ).toEqual(['p1_m1', 'p2_m1', 'shared']);
  });

  it('não busca de novo as partidas já guardadas ou descartadas', async () => {
    const api = createApi({
      fetchMatch: vi.fn(async (matchId: string) =>
        rawMatch(matchId, matchId === 'shared' ? 440 : 420),
      ),
    });
    const store = new MatchStore({ logger });
    const collector = new HighEloCollector({ api, store, logger });

    await collector.collect();
    await collector.collect();

    expect(store.size).toBe(2);
    expect(api.fetchMatch).toHaveBeenCalledTimes(3);
  });

  it('avança para os próximos jogadores a cada ciclo', async () => {
    const players = Array.from({ length: PLAYERS_PER_CYCLE + 5 }, (_, index) => `p${index}`);
    const fetchRankedMatchIds = vi.fn<HighEloApi['fetchRankedMatchIds']>(async () => []);
    const api = createApi({
      fetchHighEloPlayers: vi.fn().mockResolvedValue(players),
      fetchRankedMatchIds,
    });
    const collector = new HighEloCollector({ api, store: new MatchStore({ logger }), logger });

    await collector.collect();
    fetchRankedMatchIds.mockClear();
    await collector.collect();

    // O segundo ciclo começa onde o primeiro parou e volta ao início da lista.
    expect(fetchRankedMatchIds.mock.calls.map(([puuid]) => puuid).slice(0, 2)).toEqual([
      `p${PLAYERS_PER_CYCLE}`,
      `p${PLAYERS_PER_CYCLE + 1}`,
    ]);
  });

  it('segue para o próximo jogador quando uma chamada falha', async () => {
    const api = createApi({
      fetchRankedMatchIds: vi.fn(async (puuid: string) => {
        if (puuid === 'p1') throw new Error('HTTP error 500');
        return ['p2_m1'];
      }),
    });
    const store = new MatchStore({ logger });

    await new HighEloCollector({ api, store, logger }).collect();

    expect(store.has('p2_m1')).toBe(true);
  });

  it('não lança erro quando a lista de jogadores não pode ser obtida', async () => {
    const api = createApi({
      fetchHighEloPlayers: vi.fn().mockRejectedValue(new Error('HTTP 403')),
    });

    await expect(
      new HighEloCollector({ api, store: new MatchStore({ logger }), logger }).collect(),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('guarda os momentos de compra da linha do tempo de cada partida', async () => {
    const api = createApi();
    const store = new MatchStore({ logger });

    await new HighEloCollector({ api, store, logger }).collect();

    expect(api.fetchMatchTimeline).toHaveBeenCalledWith('p1_m1', expect.anything());
    expect(store.getAll()[0]!.participants[0]!.timeline).toEqual({
      starterItems: ['1055'],
      itemSeconds: [900],
      skillOrder: [],
    });
  });

  it('guarda a partida sem os tempos quando a linha do tempo falha', async () => {
    const api = createApi({
      fetchMatchTimeline: vi.fn().mockRejectedValue(new Error('HTTP error 500')),
    });
    const store = new MatchStore({ logger });

    await new HighEloCollector({ api, store, logger }).collect();

    expect(store.size).toBe(3);
    expect(store.getAll()[0]!.participants[0]!.timeline).toBeUndefined();
  });

  it('completa com a linha do tempo as partidas guardadas sem ela', async () => {
    const store = new MatchStore({ logger });
    const old = parseMatch(rawMatch('antiga'))!;
    store.add(old);
    const api = createApi({ fetchRankedMatchIds: vi.fn(async () => []) });

    const collector = new HighEloCollector({ api, store, logger });
    await collector.collect();

    expect(api.fetchMatchTimeline).toHaveBeenCalledWith('antiga', expect.anything());
    expect(store.getAll()[0]!.participants[0]!.timeline?.skillOrder).toEqual([]);
    expect(store.withoutTimeline(10)).toEqual([]);
  });

  it('não tenta de novo a linha do tempo que falhou', async () => {
    const store = new MatchStore({ logger });
    store.add(parseMatch(rawMatch('antiga'))!);
    const api = createApi({
      fetchRankedMatchIds: vi.fn(async () => []),
      fetchMatchTimeline: vi.fn().mockRejectedValue(new Error('HTTP error 404')),
    });
    const collector = new HighEloCollector({ api, store, logger });

    await collector.collect();
    await collector.collect();

    expect(api.fetchMatchTimeline).toHaveBeenCalledTimes(1);
  });
});
