import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiotRuneProvider, toRuneTree, type RawRuneTree } from '../../riot-rune-provider.js';

function rawRune(id: number, name: string) {
  return { id, name, icon: `perk-images/${name}.png`, shortDesc: `<b>${name}</b> causa dano.` };
}

const rawTree: RawRuneTree = {
  id: 8100,
  name: 'Dominação',
  icon: 'perk-images/Styles/7200_Domination.png',
  slots: [
    { runes: [rawRune(8112, 'Eletrocutar')] },
    { runes: [rawRune(8126, 'Golpe Desleal')] },
    { runes: [rawRune(8137, 'Sexto Sentido')] },
    { runes: [rawRune(8135, 'Caçador de Tesouros')] },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toRuneTree', () => {
  it('separa as runas principais das linhas de runas menores', () => {
    const tree = toRuneTree(rawTree);

    expect(tree.id).toBe('8100');
    expect(tree.icon).toBe(
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
    );
    expect(tree.keystones.map((rune) => rune.id)).toEqual(['8112']);
    expect(tree.slots.map((slot) => slot.map((rune) => rune.name))).toEqual([
      ['Golpe Desleal'],
      ['Sexto Sentido'],
      ['Caçador de Tesouros'],
    ]);
  });

  it('remove as tags HTML da descrição', () => {
    expect(toRuneTree(rawTree).keystones[0]!.description).toBe('Eletrocutar causa dano.');
  });
});

describe('RiotRuneProvider.fetchData', () => {
  it('busca a versão mais recente e as runas em pt_BR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(['16.21.1'])))
      .mockResolvedValueOnce(new Response(JSON.stringify([rawTree])));
    vi.stubGlobal('fetch', fetchMock);

    const data = await new RiotRuneProvider().fetchData();

    expect(data.version).toBe('16.21.1');
    expect(data.entries.map((tree) => tree.name)).toEqual(['Dominação']);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://ddragon.leagueoflegends.com/cdn/16.21.1/data/pt_BR/runesReforged.json',
      expect.anything(),
    );
  });

  it('falha quando uma árvore não tem as quatro linhas', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(['16.21.1'])))
        .mockResolvedValueOnce(
          new Response(JSON.stringify([{ ...rawTree, slots: rawTree.slots.slice(0, 2) }])),
        ),
    );

    await expect(new RiotRuneProvider().fetchData()).rejects.toThrow();
  });
});
