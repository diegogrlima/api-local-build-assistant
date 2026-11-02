import { describe, expect, it } from 'vitest';
import { loadChampionsSnapshot } from '../../champions-snapshot.js';

describe('loadChampionsSnapshot', () => {
  it('carrega um snapshot válido com versão e campeões', () => {
    const snapshot = loadChampionsSnapshot();

    expect(snapshot.version).not.toBe('');
    expect(snapshot.champions.length).toBeGreaterThan(0);
  });
});
