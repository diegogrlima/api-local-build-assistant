import type { Champion } from './champion.js';

export interface ChampionCatalog {
  getAll(): Promise<Champion[]>;
  getById(id: string): Promise<Champion | undefined>;
  getVersion(): Promise<string>;
}
