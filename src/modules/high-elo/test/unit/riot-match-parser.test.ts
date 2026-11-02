import { describe, expect, it } from 'vitest';
import { parseMatch } from '../../riot-match-parser.js';

const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

function rawParticipant(index: number, overrides: Record<string, unknown> = {}) {
  return {
    championId: index + 1,
    teamPosition: POSITIONS[index % 5],
    teamId: index < 5 ? 100 : 200,
    win: index < 5,
    gameEndedInEarlySurrender: false,
    item0: 3031,
    item1: 0,
    item2: 3006,
    item3: 1055,
    item4: 0,
    item5: 0,
    item6: 3340,
    perks: {
      statPerks: { defense: 5011, flex: 5008, offense: 5008 },
      styles: [
        {
          description: 'primaryStyle',
          style: 8000,
          selections: [{ perk: 8010 }, { perk: 9111 }, { perk: 9104 }, { perk: 8014 }],
        },
        { description: 'subStyle', style: 8100, selections: [{ perk: 8139 }, { perk: 8135 }] },
      ],
    },
    ...overrides,
  };
}

function rawMatch(overrides: Record<string, unknown> = {}, participants = range10()) {
  return {
    metadata: { matchId: 'BR1_1' },
    info: {
      gameVersion: '16.21.834.2754',
      gameCreation: 1_700_000_000_000,
      gameDuration: 1800,
      queueId: 420,
      participants,
      ...overrides,
    },
  };
}

function range10() {
  return Array.from({ length: 10 }, (_, index) => rawParticipant(index));
}

describe('parseMatch', () => {
  it('converte a partida com patch, rotas, itens finais e runas', () => {
    const sample = parseMatch(rawMatch());

    expect(sample).toMatchObject({ matchId: 'BR1_1', patch: '16.21', playedAt: 1_700_000_000_000 });
    expect(sample!.participants.map((p) => p.lane)).toEqual([
      'top',
      'jungle',
      'mid',
      'bot',
      'support',
      'top',
      'jungle',
      'mid',
      'bot',
      'support',
    ]);
    expect(sample!.participants[0]).toEqual({
      championId: '1',
      lane: 'top',
      teamId: 100,
      win: true,
      // Sem espaços vazios e sem o amuleto (item6).
      items: ['3031', '3006', '1055'],
      runes: {
        primaryTreeId: '8000',
        keystoneId: '8010',
        primaryRuneIds: ['9111', '9104', '8014'],
        secondaryTreeId: '8100',
        secondaryRuneIds: ['8139', '8135'],
      },
    });
  });

  it('descarta partidas de outra fila', () => {
    expect(parseMatch(rawMatch({ queueId: 440 }))).toBeNull();
  });

  it('descarta partidas curtas e rendições precoces', () => {
    expect(parseMatch(rawMatch({ gameDuration: 600 }))).toBeNull();

    const participants = range10();
    participants[3] = rawParticipant(3, { gameEndedInEarlySurrender: true });
    expect(parseMatch(rawMatch({}, participants))).toBeNull();
  });

  it('descarta partidas em que alguém não tem rota definida', () => {
    const participants = range10();
    participants[7] = rawParticipant(7, { teamPosition: '' });
    expect(parseMatch(rawMatch({}, participants))).toBeNull();
  });

  it('descarta respostas em formato inesperado', () => {
    expect(parseMatch({ info: {} })).toBeNull();
  });
});
