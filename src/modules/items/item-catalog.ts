import type { Item } from './item.js';

export interface ItemCatalog {
  getAll(): Promise<Item[]>;
  getById(id: string): Promise<Item | undefined>;
  getVersion(): Promise<string>;
}
