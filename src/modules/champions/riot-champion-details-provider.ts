import { z } from 'zod';
import type { VersionedData, VersionedSource } from '../../shared/catalog/in-memory-catalog.js';
import { dataUrl, fetchJson, fetchLatestVersion } from '../../shared/ddragon/ddragon-client.js';
import { stripHtml } from '../../shared/ddragon/strip-html.js';
import type { ChampionDetails, ChampionSignals, ChampionSpell } from './champion-details.js';

const SPELL_KEYS: ChampionSpell['key'][] = ['Q', 'W', 'E', 'R'];
const FULL_DATA_TIMEOUT_MS = 20_000;

const rawSpellSchema = z.object({
  name: z.string(),
  description: z.string(),
  tooltip: z.string().default(''),
});

const rawChampionSchema = z.object({
  key: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  title: z.string().default(''),
  tags: z.array(z.string()).default([]),
  info: z.object({
    attack: z.number(),
    defense: z.number(),
    magic: z.number(),
    difficulty: z.number(),
  }),
  partype: z.string().default(''),
  passive: z.object({ name: z.string(), description: z.string() }),
  spells: z.array(rawSpellSchema).length(4),
  allytips: z.array(z.string()).default([]),
  enemytips: z.array(z.string()).default([]),
});

const responseSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

type RawChampion = z.infer<typeof rawChampionSchema>;

function countTag(text: string, tag: string): number {
  return text.match(new RegExp(`<${tag}>`, 'g'))?.length ?? 0;
}

export function extractSignals(champion: RawChampion): ChampionSignals {
  const text = [
    champion.passive.description,
    ...champion.spells.map((spell) => spell.tooltip),
  ].join(' ');

  return {
    physicalDamage: countTag(text, 'physicalDamage'),
    magicDamage: countTag(text, 'magicDamage'),
    trueDamage: countTag(text, 'trueDamage'),
    healing: countTag(text, 'healing'),
    shield: countTag(text, 'shield'),
    crowdControl: countTag(text, 'status'),
    stealth: countTag(text, 'keywordStealth'),
  };
}

export function toChampionDetails(champion: RawChampion): ChampionDetails {
  return {
    id: champion.key,
    name: champion.name,
    title: champion.title,
    tags: champion.tags,
    info: champion.info,
    resource: champion.partype,
    passive: {
      name: champion.passive.name,
      description: stripHtml(champion.passive.description),
    },
    spells: champion.spells.map((spell, index) => ({
      key: SPELL_KEYS[index]!,
      name: spell.name,
      description: stripHtml(spell.description),
    })),
    allyTips: champion.allytips,
    enemyTips: champion.enemytips,
    signals: extractSignals(champion),
  };
}

// Campeões malformados são descartados em vez de derrubar o catálogo inteiro.
export function parseChampionDetails(data: Record<string, unknown>): ChampionDetails[] {
  const champions: ChampionDetails[] = [];

  for (const raw of Object.values(data)) {
    const parsed = rawChampionSchema.safeParse(raw);
    if (parsed.success) champions.push(toChampionDetails(parsed.data));
  }

  return champions;
}

// Usa o championFull.json (~2 MB), que traz as habilidades de todos os campeões numa só requisição.
export class RiotChampionDetailsProvider implements VersionedSource<ChampionDetails> {
  fetchLatestVersion(): Promise<string> {
    return fetchLatestVersion();
  }

  async fetchData(): Promise<VersionedData<ChampionDetails>> {
    const version = await this.fetchLatestVersion();

    const response = responseSchema.parse(
      await fetchJson(dataUrl(version, 'championFull.json'), { timeoutMs: FULL_DATA_TIMEOUT_MS }),
    );

    return { version, entries: parseChampionDetails(response.data) };
  }
}
