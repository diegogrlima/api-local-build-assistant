import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseChampionDetails,
  RiotChampionDetailsProvider,
} from '../../riot-champion-details-provider.js';

function rawChampion(overrides: Record<string, unknown> = {}) {
  return {
    key: '238',
    name: 'Zed',
    title: 'o Mestre das Sombras',
    tags: ['Assassin'],
    info: { attack: 9, defense: 2, magic: 1, difficulty: 7 },
    partype: 'Energia',
    passive: { name: 'Desprezo', description: 'Causa <magicDamage>dano extra</magicDamage>.' },
    spells: [
      {
        name: 'Shuriken Navalha',
        description: 'Arremessa shurikens.',
        tooltip: 'Causa <physicalDamage>dano</physicalDamage>.',
        image: { full: 'ZedQ.png' },
        maxrank: 5,
      },
      {
        name: 'Sombra Viva',
        description: 'Cria uma sombra.',
        tooltip: 'Sombra.',
        image: { full: 'ZedW.png' },
        maxrank: 5,
      },
      {
        name: 'Corte Sombrio',
        description: 'Gira as lâminas.',
        tooltip: 'Causa <physicalDamage>dano</physicalDamage> e <status>Lentidão</status>.',
        image: { full: 'ZedE.png' },
        maxrank: 5,
      },
      {
        name: 'Marca da Morte',
        description: 'Marca o alvo.<br><br>Fica <keywordStealth>invisível</keywordStealth>.',
        tooltip: '<physicalDamage>dano</physicalDamage>',
        image: { full: 'ZedR.png' },
        maxrank: 3,
      },
    ],
    allytips: ['Dica aliada'],
    enemytips: ['Dica contra'],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseChampionDetails', () => {
  it('converte o campeão usando a key numérica como id', () => {
    const [zed] = parseChampionDetails({ Zed: rawChampion() }, '16.21.1');

    expect(zed).toMatchObject({
      id: '238',
      name: 'Zed',
      tags: ['Assassin'],
      resource: 'Energia',
      allyTips: ['Dica aliada'],
      enemyTips: ['Dica contra'],
    });
    expect(zed!.spells.map((spell) => spell.key)).toEqual(['Q', 'W', 'E', 'R']);
    expect(zed!.spells[3]!.description).toBe('Marca o alvo.\nFica invisível.');
    expect(zed!.spells.map((spell) => spell.maxRank)).toEqual([5, 5, 5, 3]);
    expect(zed!.spells[0]!.icon).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.21.1/img/spell/ZedQ.png',
    );
  });

  it('conta os sinais dos tooltips e da passiva', () => {
    const [zed] = parseChampionDetails({ Zed: rawChampion() }, '16.21.1');

    expect(zed!.signals).toEqual({
      physicalDamage: 3,
      magicDamage: 1,
      trueDamage: 0,
      healing: 0,
      shield: 0,
      crowdControl: 1,
      stealth: 0,
    });
  });

  it('descarta campeões malformados', () => {
    const champions = parseChampionDetails(
      {
        Zed: rawChampion(),
        Quebrado: rawChampion({ key: undefined }),
      },
      '16.21.1',
    );

    expect(champions.map((champion) => champion.name)).toEqual(['Zed']);
  });
});

describe('RiotChampionDetailsProvider.fetchData', () => {
  it('busca o championFull.json da versão mais recente', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(['16.21.1'])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { Zed: rawChampion() } })));
    vi.stubGlobal('fetch', fetchMock);

    const { version, entries } = await new RiotChampionDetailsProvider().fetchData();

    expect(version).toBe('16.21.1');
    expect(entries.map((champion) => champion.id)).toEqual(['238']);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://ddragon.leagueoflegends.com/cdn/16.21.1/data/pt_BR/championFull.json',
      expect.anything(),
    );
  });
});
