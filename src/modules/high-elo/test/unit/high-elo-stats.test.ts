import { describe, expect, it } from 'vitest';
import type { Lane } from '../../../champions/lane.js';
import type { MatchSample, ParticipantSample, RunePage, SkillKey } from '../../match-sample.js';
import { summarizeHighElo, summarizeSkillOrder, type HighEloQuery } from '../../high-elo-stats.js';

const LANES: Lane[] = ['top', 'jungle', 'mid', 'bot', 'support'];

const conqueror: RunePage = {
  primaryTreeId: '8000',
  keystoneId: '8010',
  primaryRuneIds: ['9111', '9104', '8014'],
  secondaryTreeId: '8100',
  secondaryRuneIds: ['8139', '8135'],
};

const electrocute: RunePage = {
  primaryTreeId: '8100',
  keystoneId: '8112',
  primaryRuneIds: ['8126', '8137', '8135'],
  secondaryTreeId: '8000',
  secondaryRuneIds: ['9111', '8014'],
};

function participant(
  championId: string,
  lane: Lane,
  teamId: number,
  overrides: Partial<ParticipantSample> = {},
): ParticipantSample {
  return { championId, lane, teamId, win: false, items: [], runes: conqueror, ...overrides };
}

// Partida em que o jogador "1" está no time 100 contra os campeões informados (um por rota).
function match(
  id: string,
  player: Partial<ParticipantSample> & { lane?: Lane },
  enemyIds: string[],
  patch = '16.21',
): MatchSample {
  const { lane = 'top', ...overrides } = player;
  const allies = LANES.map((l, index) =>
    l === lane ? participant('1', l, 100, overrides) : participant(`a${index}`, l, 100),
  );
  const enemies = LANES.map((l, index) => participant(enemyIds[index]!, l, 200));
  return { matchId: id, patch, playedAt: 0, participants: [...allies, ...enemies] };
}

const query: HighEloQuery = {
  championId: '1',
  lane: 'top',
  enemies: [
    { championId: '2', lane: 'top' },
    { championId: '3', lane: 'jungle' },
  ],
  allowedItemIds: new Set(['3031', '3006', '3026']),
  starterItemIds: new Set(['1055', '2003']),
};

describe('summarizeHighElo', () => {
  it('devolve null quando não há partidas do campeão na rota', () => {
    const matches = [match('m1', { lane: 'mid' }, ['2', '3', '4', '5', '6'])];
    expect(summarizeHighElo(matches, query)).toBeNull();
  });

  it('conta partidas, vitórias, itens permitidos e runas', () => {
    const matches = [
      match('m1', { win: true, items: ['3031', '3006', '1055'] }, ['2', '3', '4', '5', '6']),
      match('m2', { win: false, items: ['3031', '3031', '3026'] }, ['7', '8', '9', '10', '11']),
      match(
        'm3',
        { win: true, items: ['3006'], runes: electrocute },
        ['7', '8', '9', '10', '11'],
        '16.20',
      ),
    ];

    const summary = summarizeHighElo(matches, query)!;

    expect(summary).toMatchObject({ matches: 3, wins: 2, patches: ['16.20', '16.21'] });
    // O componente 1055 fica de fora e itens repetidos contam uma vez por partida.
    expect(summary.items).toEqual([
      { itemId: '3006', matches: 2, wins: 2 },
      { itemId: '3031', matches: 2, wins: 1 },
      { itemId: '3026', matches: 1, wins: 0 },
    ]);
    expect(summary.keystones).toEqual([
      { keystoneId: '8010', primaryTreeId: '8000', matches: 2, wins: 1 },
      { keystoneId: '8112', primaryTreeId: '8100', matches: 1, wins: 1 },
    ]);
    expect(summary.runePages[0]).toEqual({ page: conqueror, matches: 2, wins: 1 });
  });

  it('agrupa páginas iguais mesmo com as runas secundárias em outra ordem', () => {
    const reversed = { ...conqueror, secondaryRuneIds: ['8135', '8139'] };
    const matches = [
      match('m1', {}, ['2', '3', '4', '5', '6']),
      match('m2', { runes: reversed }, ['2', '3', '4', '5', '6']),
    ];

    expect(summarizeHighElo(matches, query)!.runePages).toHaveLength(1);
  });

  it('separa o que foi usado contra cada adversário, exigindo a mesma rota para o oponente direto', () => {
    const matches = [
      match('m1', { win: true, items: ['3026'] }, ['2', '3', '4', '5', '6']),
      // "2" na selva não é oponente direto do jogador no topo; "3" conta em qualquer rota.
      match('m2', { items: ['3031'] }, ['3', '2', '4', '5', '6']),
      match('m3', { items: ['3006'] }, ['7', '8', '9', '10', '11']),
    ];

    const [versusLane, versusJungle] = summarizeHighElo(matches, query)!.versusEnemies;

    expect(versusLane).toEqual({
      championId: '2',
      laneOpponent: true,
      matches: 1,
      wins: 1,
      items: [{ itemId: '3026', matches: 1, wins: 1 }],
    });
    expect(versusJungle).toMatchObject({ championId: '3', laneOpponent: false, matches: 2 });
  });

  it('monta o caminho da build só com as partidas que têm a linha do tempo', () => {
    const matches = [
      match(
        'm1',
        {
          items: ['3031', '1055', '3006'],
          timeline: { starterItems: ['1055', '2003', '3340'], itemSeconds: [900, 60, 500] },
        },
        ['2', '3', '4', '5', '6'],
      ),
      match(
        'm2',
        {
          items: ['3006', '3031', '3026'],
          timeline: { starterItems: ['2003', '1055'], itemSeconds: [600, 1100, null] },
        },
        ['2', '3', '4', '5', '6'],
      ),
      match('m3', { items: ['3006'] }, ['2', '3', '4', '5', '6']),
    ];

    const { buildPath } = summarizeHighElo(matches, query)!;

    // Fora do caminho: o trinket (3340), o componente (1055) no inventário e o item sem tempo.
    expect(buildPath).toEqual({
      matches: 2,
      starterItems: ['1055', '2003'],
      starterMatches: 2,
      itemSeconds: [550, 1000, null, null, null, null],
    });
  });

  it('não monta o caminho da build sem linha do tempo', () => {
    const matches = [match('m1', { items: ['3006'] }, ['2', '3', '4', '5', '6'])];

    expect(summarizeHighElo(matches, query)!.buildPath).toBeNull();
  });

  it('monta a ordem de habilidades mais comum nível a nível e a prioridade', () => {
    const timeline = (skillOrder: SkillKey[]) => ({
      starterItems: [],
      itemSeconds: [],
      skillOrder,
    });
    const qew: SkillKey[] = ['Q', 'E', 'W', 'Q', 'Q', 'R', 'Q', 'E', 'Q'];
    const matches = [
      ...['m1', 'm2', 'm3'].map((id) =>
        match(id, { timeline: timeline(qew) }, ['2', '3', '4', '5', '6']),
      ),
      // Começa diferente: não muda a sequência e não conta nos níveis seguintes.
      match('m4', { timeline: timeline(['E', 'Q', 'W', 'E']) }, ['2', '3', '4', '5', '6']),
      match('m5', { timeline: timeline(['E', 'Q', 'W', 'E']) }, ['2', '3', '4', '5', '6']),
      match('m6', {}, ['2', '3', '4', '5', '6']),
    ];

    expect(summarizeSkillOrder(matches, query)).toEqual({
      scope: 'lane',
      matches: 5,
      levels: qew,
      priority: ['Q', 'E', 'W'],
    });
  });

  it('para a sequência quando poucas partidas seguiram o mesmo caminho', () => {
    const timeline = (skillOrder: SkillKey[]) => ({
      starterItems: [],
      itemSeconds: [],
      skillOrder,
    });
    const matches = [
      match('m1', { timeline: timeline(['Q', 'W', 'E', 'Q']) }, ['2', '3', '4', '5', '6']),
      match('m2', { timeline: timeline(['Q', 'W', 'E', 'E']) }, ['2', '3', '4', '5', '6']),
      match('m3', { timeline: timeline(['Q', 'W', 'E', 'W']) }, ['2', '3', '4', '5', '6']),
    ];

    expect(summarizeSkillOrder(matches, query)!.levels).toEqual(['Q', 'W', 'E']);
  });

  it('não monta a ordem de habilidades sem linha do tempo', () => {
    const matches = [match('m1', {}, ['2', '3', '4', '5', '6'])];

    expect(summarizeSkillOrder(matches, query)).toBeNull();
  });

  it('usa as partidas do campeão em outras rotas quando a rota não tem a ordem', () => {
    const timeline = {
      starterItems: [],
      itemSeconds: [],
      skillOrder: ['Q', 'E', 'W'] as SkillKey[],
    };
    const matches = ['m1', 'm2', 'm3'].map((id) =>
      match(id, { lane: 'mid', timeline }, ['2', '3', '4', '5', '6']),
    );

    expect(summarizeSkillOrder(matches, query)).toMatchObject({
      scope: 'champion',
      matches: 3,
      levels: ['Q', 'E', 'W'],
    });
  });
});
