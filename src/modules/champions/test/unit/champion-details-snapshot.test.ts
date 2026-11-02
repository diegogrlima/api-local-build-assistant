import { describe, expect, it } from 'vitest';
import { loadChampionDetailsSnapshot } from '../../champion-details-snapshot.js';
import { loadChampionsSnapshot } from '../../champions-snapshot.js';

describe('loadChampionDetailsSnapshot', () => {
  it('carrega um snapshot válido com versão e campeões', () => {
    const snapshot = loadChampionDetailsSnapshot();

    expect(snapshot.version).not.toBe('');
    expect(snapshot.entries.length).toBeGreaterThan(0);
  });

  it('tem detalhes para todos os campeões do snapshot do catálogo', () => {
    const detailIds = new Set(loadChampionDetailsSnapshot().entries.map((champion) => champion.id));
    const missing = loadChampionsSnapshot().champions.filter(
      (champion) => !detailIds.has(champion.id),
    );

    expect(missing).toEqual([]);
  });
});
