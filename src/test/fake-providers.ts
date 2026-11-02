import type { Item } from '../modules/items/item.js';
import type { ItemProvider } from '../modules/items/item-provider.js';

export function createItem(overrides: Partial<Item> & Pick<Item, 'id' | 'name'>): Item {
  return {
    plaintext: '',
    description: '',
    gold: 3000,
    tags: [],
    isBoots: false,
    icon: `${overrides.id}.png`,
    ...overrides,
  };
}

export function createFakeItemProvider(items: Item[] = []): ItemProvider {
  return {
    fetchLatestVersion: async () => '9.9.9',
    fetchCatalog: async () => ({ version: '9.9.9', items }),
  };
}
