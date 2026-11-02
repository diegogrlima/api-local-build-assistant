import { z } from 'zod';
import type { ChampionCatalog } from './champion-catalog.js';
import type { Champion } from './champion.js';

const BASE_URL = 'https://ddragon.leagueoflegends.com';
const LOCALE = 'pt_BR';
const TIMEOUT_MS = 5000;

// Schemas de validação
const versionSchema = z.array(z.string().min(1));

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

  async fetchLatestVersion(): Promise<string> {
    const versions = await this.fetchJson(`${BASE_URL}/api/versions.json`);

    const version = versionSchema.parse(versions)[0];

    if (!version) {
      throw new Error('No versions available from Riot.');
    }

    return version;
  }

  async fetchCatalog(): Promise<{
    version: string;
    champions: Champion[];
  }> {
    const version = await this.fetchLatestVersion();

    const url = `${BASE_URL}/cdn/${version}/data/${LOCALE}/champion.json`;

    const response = await this.fetchJson(url);

    const validatedResponse = championResponseSchema.parse(response);

    const champions: Champion[] = Object.values(validatedResponse.data).map((champion) => ({
      id: champion.key,
      name: champion.name,
      icon: `${BASE_URL}/cdn/${version}/img/champion/${champion.image.full}`,
    }));

    return {
      version,
      champions,
    };
  }

  private async fetchJson(url: string): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Timeout accessing ${url}`, {
          cause: error,
        });
      }

      throw new Error(`Network failure when accessing ${url}`, {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} when accessing ${url}`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Invalid JSON response from ${url}`, {
        cause: error,
      });
    }
  }
}
