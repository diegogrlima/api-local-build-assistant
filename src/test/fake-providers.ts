import type { VersionedSource } from '../shared/catalog/in-memory-catalog.js';
import type { Champion } from '../modules/champions/champion.js';
import type { ChampionDetails } from '../modules/champions/champion-details.js';
import type { ChampionProvider } from '../modules/champions/champion-provider.js';
import type { Item } from '../modules/items/item.js';
import type { ItemProvider } from '../modules/items/item-provider.js';
import type { Rune, RuneTree } from '../modules/runes/rune.js';

const VERSION = '9.9.9';

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

export function createChampionDetails(
  overrides: Partial<ChampionDetails> & Pick<ChampionDetails, 'id' | 'name'>,
): ChampionDetails {
  return {
    title: '',
    tags: [],
    info: { attack: 5, defense: 5, magic: 5, difficulty: 5 },
    resource: 'Mana',
    passive: { name: 'Passiva', description: '' },
    spells: [],
    allyTips: [],
    enemyTips: [],
    signals: {
      physicalDamage: 0,
      magicDamage: 0,
      trueDamage: 0,
      healing: 0,
      shield: 0,
      crowdControl: 0,
      stealth: 0,
    },
    ...overrides,
  };
}

// Campeões "1" a "7" e um conjunto de itens suficiente para montar uma build válida.
export const testChampions: Champion[] = ['1', '2', '3', '4', '5', '6', '7'].map((id) => ({
  id,
  name: `Campeão ${id}`,
  icon: `${id}.png`,
}));

export const testItems: Item[] = [
  createItem({ id: '3006', name: 'Grevas do Berserker', isBoots: true, gold: 1100 }),
  createItem({ id: '3111', name: 'Passos de Mercúrio', isBoots: true, gold: 1250 }),
  createItem({ id: '3031', name: 'Gume do Infinito', gold: 3500 }),
  createItem({ id: '3033', name: 'Lembrete Mortal', gold: 3000 }),
  createItem({ id: '3036', name: 'Lembranças do Lorde Dominik', gold: 3300 }),
  createItem({ id: '3072', name: 'Sedenta por Sangue', gold: 3400 }),
  createItem({ id: '3026', name: 'Anjo Guardião', gold: 3200 }),
];

function rune(id: string, name: string): Rune {
  return { id, name, description: `Efeito de ${name}.`, icon: `${id}.png` };
}

// Duas árvores com a mesma estrutura do Data Dragon: runas principais e três linhas.
export const testRuneTrees: RuneTree[] = [
  {
    id: '8000',
    name: 'Precisão',
    icon: '8000.png',
    keystones: [rune('8005', 'Pressione o Ataque'), rune('8010', 'Conquistador')],
    slots: [
      [rune('9111', 'Triunfo'), rune('8009', 'Presença de Espírito')],
      [rune('9104', 'Lenda: Espontaneidade'), rune('9105', 'Lenda: Aceleração')],
      [rune('8014', 'Golpe de Misericórdia'), rune('8299', 'Até a Morte')],
    ],
  },
  {
    id: '8100',
    name: 'Dominação',
    icon: '8100.png',
    keystones: [rune('8112', 'Eletrocutar')],
    slots: [
      [rune('8126', 'Golpe Desleal'), rune('8139', 'Gosto de Sangue')],
      [rune('8137', 'Sexto Sentido'), rune('8140', 'Lembranças Aterrorizantes')],
      [rune('8135', 'Caçador de Tesouros'), rune('8106', 'Caça Suprema')],
    ],
  },
];

export function createFakeChampionProvider(
  champions: Champion[] = testChampions,
): ChampionProvider {
  return {
    fetchLatestVersion: async () => VERSION,
    fetchCatalog: async () => ({ version: VERSION, champions }),
  };
}

export function createFakeChampionDetailsProvider(
  details: ChampionDetails[] = testChampions.map((champion) =>
    createChampionDetails({ id: champion.id, name: champion.name }),
  ),
): VersionedSource<ChampionDetails> {
  return {
    fetchLatestVersion: async () => VERSION,
    fetchData: async () => ({ version: VERSION, entries: details }),
  };
}

export function createFakeItemProvider(items: Item[] = []): ItemProvider {
  return {
    fetchLatestVersion: async () => VERSION,
    fetchCatalog: async () => ({ version: VERSION, items }),
  };
}

export function createFakeRuneProvider(
  trees: RuneTree[] = testRuneTrees,
): VersionedSource<RuneTree> {
  return {
    fetchLatestVersion: async () => VERSION,
    fetchData: async () => ({ version: VERSION, entries: trees }),
  };
}

// Entrada válida: campeão "1" no topo contra "2" a "6", um em cada rota.
export const validMatchupInput = {
  championId: '1',
  lane: 'top',
  enemies: [
    { championId: '2', lane: 'top' },
    { championId: '3', lane: 'jungle' },
    { championId: '4', lane: 'mid' },
    { championId: '5', lane: 'bot' },
    { championId: '6', lane: 'support' },
  ],
};

export function createValidRunes() {
  return {
    primaryTreeId: '8000',
    keystoneId: '8010',
    primaryRuneIds: ['9111', '9104', '8014'],
    secondaryTreeId: '8100',
    secondaryRuneIds: ['8139', '8135'],
    reason: 'Motivo das runas.',
  };
}

// Resposta da IA que passa na validação para o confronto "1" contra "2" a "6".
export function createValidAdvisorResponse() {
  return {
    threats: [{ championId: '2', reason: 'Muito dano físico explosivo.' }],
    items: ['3006', '3031', '3033', '3036', '3072', '3026'].map((itemId) => ({
      itemId,
      reason: `Motivo do item ${itemId}.`,
    })),
    runes: createValidRunes(),
    justification: 'Justificativa da build.',
    balance: 'Equilíbrio entre dano e proteção.',
    warnings: [],
  };
}
