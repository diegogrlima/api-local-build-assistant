import type { Lane } from '../champions/lane.js';
import type { Item } from '../items/item.js';

// Ouro com que cada jogador começa a partida.
export const STARTING_GOLD = 500;

export function isJungleCompanion(item: Item): boolean {
  return item.tags.includes('Jungle') && !item.tags.includes('Consumable');
}

// Item de suporte (Atlas Mundial): o único que gera ouro com a missão de suporte.
export function isSupportItem(item: Item): boolean {
  return item.tags.includes('GoldPer');
}

// Itens que podem compor a compra inicial: sem receita, até o ouro inicial e próprios da fase
// de rotas ou da selva. Ficam de fora os elixires e outros consumíveis de fim de jogo.
export function starterCandidates(catalog: Item[]): Item[] {
  const byName = new Map<string, Item>();
  for (const item of catalog) {
    if (item.isBuildItem || item.from.length > 0 || item.gold > STARTING_GOLD) continue;
    const early = item.tags.includes('Lane') || item.tags.includes('Jungle');
    if (item.tags.includes('Consumable') && !early) continue;
    // O Data Dragon publica alguns itens repetidos (ex.: companheiros da selva) com ids diferentes.
    if (!byName.has(item.name)) byName.set(item.name, item);
  }
  return [...byName.values()];
}

// Regras do jogo para a compra inicial: cabe no ouro inicial, companheiro só (e sempre) na selva
// e item de suporte só (e sempre) no suporte.
export function validateStarterItems(
  itemIds: string[],
  lane: Lane,
  starters: ReadonlyMap<string, Item>,
): string[] {
  const unknown = itemIds.filter((id) => !starters.has(id));
  if (unknown.length > 0) {
    return [`Itens iniciais fora da lista permitida: ${unknown.join(', ')}.`];
  }
  if (itemIds.length === 0) return ['Informe ao menos um item inicial.'];

  const problems: string[] = [];
  const items = itemIds.map((id) => starters.get(id)!);

  const gold = items.reduce((total, item) => total + item.gold, 0);
  if (gold > STARTING_GOLD) {
    problems.push(`A compra inicial custa ${gold} de ouro; o máximo é ${STARTING_GOLD}.`);
  }

  const companions = items.filter(isJungleCompanion).length;
  if (lane === 'jungle' && companions !== 1) {
    problems.push('Na selva, a compra inicial deve ter exatamente 1 companheiro da selva.');
  } else if (lane !== 'jungle' && companions > 0) {
    problems.push('Companheiros da selva só podem ser comprados por quem joga na selva.');
  }

  const supportItems = items.filter(isSupportItem).length;
  if (lane === 'support' && supportItems !== 1) {
    problems.push('No suporte, a compra inicial deve ter exatamente 1 item de suporte.');
  } else if (lane !== 'support' && supportItems > 0) {
    problems.push('O item de suporte só deve ser comprado por quem joga no suporte.');
  }

  return problems;
}
