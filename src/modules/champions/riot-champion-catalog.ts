import { z } from 'zod';
import type { ChampionCatalog } from './champion-catalog.js';
import type { Champion } from './champion.js';
import {
  dataUrl,
  fetchJson,
  fetchLatestVersion,
  imageUrl,
} from '../../shared/ddragon/ddragon-client.js';

// Schemas de validação
const championSchema = z.object({
  key: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  image: z.object({
    full: z.string().min(1),
  }),
});

const championResponseSchema = z.object({
  data: z.record(z.string(), championSchema),
});

// Implementação do catálogo
export class RiotChampCatalog implements ChampionCatalog {
  private catalogPromise: Promise<{
    version: string;
    champions: Champion[];
  }> | null = null;

  async getAll(): Promise<Champion[]> {
    const catalog = await this.loadCatalog();
    return catalog.champions;
  }

  async getById(id: string): Promise<Champion | undefined> {
    const catalog = await this.loadCatalog();

    return catalog.champions.find((champion) => champion.id === id);
  }

  async getVersion(): Promise<string> {
    const catalog = await this.loadCatalog();
    return catalog.version;
  }

  private loadCatalog(): Promise<{
    version: string;
    champions: Champion[];
  }> {
    if (!this.catalogPromise) {
      this.catalogPromise = this.fetchCatalog().catch((error: unknown) => {
        this.catalogPromise = null;
        throw error;
      });
    }

    return this.catalogPromise;
  }

  fetchLatestVersion(): Promise<string> {
    return fetchLatestVersion();
  }

  async fetchCatalog(): Promise<{
    version: string;
    champions: Champion[];
  }> {
    const version = await this.fetchLatestVersion();

    const response = await fetchJson(dataUrl(version, 'champion.json'));

    const validatedResponse = championResponseSchema.parse(response);

    const champions: Champion[] = Object.values(validatedResponse.data).map((champion) => ({
      id: champion.key,
      name: champion.name,
      icon: imageUrl(version, 'champion', champion.image.full),
    }));

    return {
      version,
      champions,
    };
  }
}
