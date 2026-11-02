import { describe, expect, it } from 'vitest';
import type { MatchSample, ParticipantSample } from '../../match-sample.js';
import { addPurchaseTimeline } from '../../riot-timeline-parser.js';

function participant(items: string[]): ParticipantSample {
  return {
    championId: '1',
    lane: 'top',
    teamId: 100,
    win: true,
    items,
    runes: {
      primaryTreeId: '8000',
      keystoneId: '8010',
      primaryRuneIds: ['9111', '9104', '8014'],
      secondaryTreeId: '8100',
      secondaryRuneIds: ['8139', '8135'],
    },
  };
}

const sample: MatchSample = {
  matchId: 'BR1_1',
  patch: '16.21',
  playedAt: 0,
  participants: [participant(['3031', '3006', '6672']), participant(['3026'])],
};

function event(type: string, second: number, participantId: number, extra: object) {
  return { type, timestamp: second * 1000, participantId, ...extra };
}

describe('addPurchaseTimeline', () => {
  it('guarda a compra inicial, o momento de compra dos itens finais e a ordem das habilidades', () => {
    const raw = {
      info: {
        frames: [
          {
            events: [
              event('ITEM_PURCHASED', 3, 1, { itemId: 1055 }),
              event('ITEM_PURCHASED', 4, 1, { itemId: 2003 }),
              event('ITEM_PURCHASED', 5, 1, { itemId: 2003 }),
              // Compra desfeita: não conta.
              event('ITEM_UNDO', 6, 1, { beforeId: 2003, afterId: 0 }),
              { type: 'CHAMPION_KILL', timestamp: 300_000 },
              event('SKILL_LEVEL_UP', 10, 1, { skillSlot: 1, levelUpType: 'NORMAL' }),
              event('SKILL_LEVEL_UP', 120, 1, { skillSlot: 3, levelUpType: 'NORMAL' }),
              // Evolução (ex.: Kha'Zix) não é ponto de habilidade.
              event('SKILL_LEVEL_UP', 130, 1, { skillSlot: 1, levelUpType: 'EVOLVE' }),
              event('SKILL_LEVEL_UP', 400, 1, { skillSlot: 4, levelUpType: 'NORMAL' }),
            ],
          },
          {
            events: [
              event('ITEM_PURCHASED', 600, 1, { itemId: 3006 }),
              event('ITEM_PURCHASED', 840, 1, { itemId: 3031 }),
              event('ITEM_SOLD', 1500, 1, { itemId: 3031 }),
              event('ITEM_PURCHASED', 1560, 1, { itemId: 3031 }),
              event('ITEM_PURCHASED', 1200, 2, { itemId: 3026 }),
            ],
          },
        ],
      },
    };

    const [first, second] = addPurchaseTimeline(sample, raw).participants;

    // O item vale pela última compra; 6672 não tem compra registrada.
    expect(first!.timeline).toEqual({
      starterItems: ['1055', '2003'],
      itemSeconds: [1560, 600, null],
      skillOrder: ['Q', 'E', 'R'],
    });
    expect(second!.timeline).toEqual({ starterItems: [], itemSeconds: [1200], skillOrder: [] });
  });

  it('devolve a partida sem alterações quando a linha do tempo é inválida', () => {
    expect(addPurchaseTimeline(sample, { info: {} })).toBe(sample);
  });
});
