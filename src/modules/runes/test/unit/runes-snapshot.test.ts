import { describe, expect, it } from 'vitest';
import { loadRunesSnapshot } from '../../runes-snapshot.js';

describe('loadRunesSnapshot', () => {
  it('carrega um snapshot válido com as árvores de runas', () => {
    const snapshot = loadRunesSnapshot();

    expect(snapshot.version).not.toBe('');
    expect(snapshot.entries.length).toBeGreaterThan(0);
  });

  it('tem runas principais e três linhas de runas menores em cada árvore', () => {
    for (const tree of loadRunesSnapshot().entries) {
      expect(tree.keystones.length).toBeGreaterThan(0);
      expect(tree.slots).toHaveLength(3);
    }
  });
});
