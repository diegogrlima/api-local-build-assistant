import { describe, expect, it, vi } from 'vitest';
import { InMemoryItemCatalog } from '../../in-memory-item-catalog.js';
import type { ItemCatalogData } from '../../item-provider.js';
import { createFakeItemProvider, createItem } from '../../../../test/fake-providers.js';

const snapshot: ItemCatalogData = {
  version: '1.0.0',
  items: [createItem({ id: '3031', name: 'Gume do Infinito' })],
};

function createCatalog(provider = createFakeItemProvider()) {
  const logger = { info: vi.fn(), warn: vi.fn() };
  return { catalog: new InMemoryItemCatalog({ provider, snapshot, logger }), logger };
}

describe('InMemoryItemCatalog', () => {
  it('carrega os itens do provider', async () => {
    const provider = createFakeItemProvider([createItem({ id: '3089', name: 'Capuz da Morte' })]);
    const { catalog } = createCatalog(provider);

    await catalog.init();

    expect(await catalog.getVersion()).toBe('9.9.9');
    expect(await catalog.getById('3089')).toMatchObject({ name: 'Capuz da Morte' });
  });

  it('cai no snapshot quando o provider falha', async () => {
    const { catalog, logger } = createCatalog({
      fetchLatestVersion: vi.fn().mockRejectedValue(new Error('Riot fora do ar')),
      fetchCatalog: vi.fn().mockRejectedValue(new Error('Riot fora do ar')),
    });

    await catalog.init();

    expect(await catalog.getVersion()).toBe('1.0.0');
    expect(await catalog.getAll()).toEqual(snapshot.items);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
