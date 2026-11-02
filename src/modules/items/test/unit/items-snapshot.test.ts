import { describe, expect, it } from 'vitest';
import { loadItemsSnapshot } from '../../items-snapshot.js';

describe('loadItemsSnapshot', () => {
  it('carrega um snapshot válido com versão e itens', () => {
    const snapshot = loadItemsSnapshot();

    expect(snapshot.version).not.toBe('');
    expect(snapshot.items.length).toBeGreaterThan(0);
  });

  it('separa os itens de build, sem consumíveis, dos itens iniciais e componentes', () => {
    const { items } = loadItemsSnapshot();
    const buildItems = items.filter((item) => item.isBuildItem);

    expect(buildItems.some((item) => item.tags.includes('Consumable'))).toBe(false);
    expect(buildItems.some((item) => item.isBoots)).toBe(true);
    expect(items.some((item) => !item.isBuildItem)).toBe(true);
  });

  it('tem no catálogo os componentes das receitas dos itens de build', () => {
    const { items } = loadItemsSnapshot();
    const ids = new Set(items.map((item) => item.id));

    expect(
      items
        .filter((item) => item.isBuildItem)
        .flatMap((item) => item.from)
        .filter((id) => !ids.has(id)),
    ).toEqual([]);
  });
});
