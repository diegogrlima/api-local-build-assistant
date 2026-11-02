import { describe, expect, it } from 'vitest';
import { loadItemsSnapshot } from '../../items-snapshot.js';

describe('loadItemsSnapshot', () => {
  it('carrega um snapshot válido com versão e itens', () => {
    const snapshot = loadItemsSnapshot();

    expect(snapshot.version).not.toBe('');
    expect(snapshot.items.length).toBeGreaterThan(0);
  });

  it('contém apenas itens de build, sem consumíveis', () => {
    const { items } = loadItemsSnapshot();

    expect(items.some((item) => item.tags.includes('Consumable'))).toBe(false);
    expect(items.some((item) => item.isBoots)).toBe(true);
  });
});
