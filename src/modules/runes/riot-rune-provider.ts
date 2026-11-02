import { z } from 'zod';
import type { VersionedData, VersionedSource } from '../../shared/catalog/in-memory-catalog.js';
import {
  DDRAGON_BASE_URL,
  dataUrl,
  fetchJson,
  fetchLatestVersion,
} from '../../shared/ddragon/ddragon-client.js';
import { stripHtml } from '../../shared/ddragon/strip-html.js';
import type { Rune, RuneTree } from './rune.js';

// Linha das runas principais seguida das três linhas de runas menores.
const SLOT_COUNT = 4;

const rawRuneSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  icon: z.string().min(1),
  shortDesc: z.string(),
});

const rawTreeSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  icon: z.string().min(1),
  slots: z.array(z.object({ runes: z.array(rawRuneSchema).min(1) })).length(SLOT_COUNT),
});

const responseSchema = z.array(rawTreeSchema).min(1);

export type RawRuneTree = z.infer<typeof rawTreeSchema>;

// As imagens de runas não são versionadas no Data Dragon.
function runeImageUrl(path: string): string {
  return `${DDRAGON_BASE_URL}/cdn/img/${path}`;
}

function toRune(rune: z.infer<typeof rawRuneSchema>): Rune {
  return {
    id: String(rune.id),
    name: rune.name,
    description: stripHtml(rune.shortDesc),
    icon: runeImageUrl(rune.icon),
  };
}

export function toRuneTree(tree: RawRuneTree): RuneTree {
  const [keystones, ...slots] = tree.slots.map((slot) => slot.runes.map(toRune));
  return {
    id: String(tree.id),
    name: tree.name,
    icon: runeImageUrl(tree.icon),
    keystones: keystones!,
    slots,
  };
}

export class RiotRuneProvider implements VersionedSource<RuneTree> {
  fetchLatestVersion(): Promise<string> {
    return fetchLatestVersion();
  }

  async fetchData(): Promise<VersionedData<RuneTree>> {
    const version = await this.fetchLatestVersion();

    const trees = responseSchema.parse(await fetchJson(dataUrl(version, 'runesReforged.json')));

    return { version, entries: trees.map(toRuneTree) };
  }
}
