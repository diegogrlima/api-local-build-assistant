import { z } from 'zod';
import {
  dataUrl,
  fetchJson,
  fetchLatestVersion,
  imageUrl,
} from '../../shared/ddragon/ddragon-client.js';
import type { Item } from './item.js';
import type { ItemCatalogData, ItemProvider } from './item-provider.js';

const SUMMONERS_RIFT_MAP_ID = '11';

// O Data Dragon também publica variantes de itens de outros modos (Arena, ARAM...) com ids
// de 6 dígitos e, às vezes, marcadas como disponíveis em Summoner's Rift.
const MAX_SUMMONERS_RIFT_ITEM_ID = 9999;

const EXCLUDED_TAGS = ['Consumable', 'Trinket', 'GoldPer'];

const rawItemSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  plaintext: z.string().optional(),
  from: z.array(z.string()).optional(),
  into: z.array(z.string()).optional(),
  image: z.object({ full: z.string().min(1) }),
  gold: z.object({ total: z.number(), purchasable: z.boolean() }),
  tags: z.array(z.string()).optional(),
  maps: z.record(z.string(), z.boolean()),
  depth: z.number().optional(),
  inStore: z.boolean().optional(),
  hideFromAll: z.boolean().optional(),
  consumed: z.boolean().optional(),
  requiredChampion: z.string().optional(),
  requiredAlly: z.string().optional(),
});

// Cada item é validado separadamente: o Data Dragon traz entradas incompletas (ex.: sem nome)
// que não devem derrubar o catálogo inteiro.
const itemResponseSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

export type RawItem = z.infer<typeof rawItemSchema>;

// Alguns upgrades de botas (ex.: Grevas Bélicas) não trazem a tag "Boots",
// então também contam como botas os itens montados a partir de outras botas.
function isBoots(item: RawItem, bootsIds: ReadonlySet<string>): boolean {
  return (item.tags ?? []).includes('Boots') || (item.from ?? []).some((id) => bootsIds.has(id));
}

// Itens que fazem sentido numa build de Summoner's Rift: itens completos e botas
// (as botas de tier 2 ainda evoluem, por isso têm "into").
export function isBuildItem(id: string, item: RawItem, boots: boolean): boolean {
  const tags = item.tags ?? [];

  if (Number(id) > MAX_SUMMONERS_RIFT_ITEM_ID) return false;
  if (!item.maps[SUMMONERS_RIFT_MAP_ID]) return false;
  if (!item.gold.purchasable || item.inStore === false || item.hideFromAll) return false;
  if (item.requiredChampion || item.requiredAlly || item.consumed) return false;
  if (tags.some((tag) => EXCLUDED_TAGS.includes(tag))) return false;

  // Itens iniciais e componentes básicos não têm profundidade (depth) ou têm depth 1.
  if ((item.depth ?? 1) < 2) return false;

  const isFinal = !item.into || item.into.length === 0;
  return boots || isFinal;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function toItem(id: string, item: RawItem, version: string, boots: boolean): Item {
  return {
    id,
    name: item.name,
    plaintext: item.plaintext ?? '',
    description: stripHtml(item.description),
    gold: item.gold.total,
    tags: item.tags ?? [],
    isBoots: boots,
    icon: imageUrl(version, 'item', item.image.full),
  };
}

export function parseItems(data: Record<string, unknown>, version: string): Item[] {
  const valid = new Map<string, RawItem>();
  for (const [id, raw] of Object.entries(data)) {
    const parsed = rawItemSchema.safeParse(raw);
    if (parsed.success) valid.set(id, parsed.data);
  }

  const bootsIds = new Set(
    [...valid].filter(([, item]) => (item.tags ?? []).includes('Boots')).map(([id]) => id),
  );

  const items: Item[] = [];
  for (const [id, item] of valid) {
    const boots = isBoots(item, bootsIds);
    if (isBuildItem(id, item, boots)) {
      items.push(toItem(id, item, version, boots));
    }
  }

  return items;
}

export class RiotItemProvider implements ItemProvider {
  fetchLatestVersion(): Promise<string> {
    return fetchLatestVersion();
  }

  async fetchCatalog(): Promise<ItemCatalogData> {
    const version = await this.fetchLatestVersion();

    const response = itemResponseSchema.parse(await fetchJson(dataUrl(version, 'item.json')));

    return { version, items: parseItems(response.data, version) };
  }
}
