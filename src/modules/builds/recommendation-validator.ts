import { z } from 'zod';
import type { Lane } from '../champions/lane.js';
import type { Item } from '../items/item.js';
import type { RuneTree } from '../runes/rune.js';
import { BUILD_SIZE, MAX_BOOTS, PRIMARY_RUNES, SECONDARY_RUNES } from './recommendation-prompt.js';
import { validateStarterItems } from './starter-items.js';

const rawRecommendationSchema = z.object({
  threats: z.array(z.object({ championId: z.string(), reason: z.string().trim().min(1) })),
  starter: z.object({ itemIds: z.array(z.string()), reason: z.string().trim().min(1) }),
  skillPriority: z
    .object({ order: z.array(z.enum(['Q', 'W', 'E', 'R'])), reason: z.string().trim().min(1) })
    .optional(),
  items: z.array(z.object({ itemId: z.string(), reason: z.string().trim().min(1) })),
  runes: z.object({
    primaryTreeId: z.string(),
    keystoneId: z.string(),
    primaryRuneIds: z.array(z.string()),
    secondaryTreeId: z.string(),
    secondaryRuneIds: z.array(z.string()),
    reason: z.string().trim().min(1),
  }),
  justification: z.string().trim().min(1),
  balance: z.string().trim().min(1),
  warnings: z.array(z.string()).default([]),
});

export type RawRecommendation = z.infer<typeof rawRecommendationSchema>;

export type ValidationResult =
  { ok: true; value: RawRecommendation } | { ok: false; problems: string[] };

type Rules = {
  items: ReadonlyMap<string, Item>;
  starterItems: ReadonlyMap<string, Item>;
  lane: Lane;
  // Pedida só quando não há ordem de habilidades nas partidas de alto elo.
  requireSkillPriority?: boolean;
  enemyIds: ReadonlySet<string>;
  runeTrees: ReadonlyMap<string, RuneTree>;
};

type RawRunes = RawRecommendation['runes'];

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

// Índice da linha de runas menores em que a runa está, ou -1 se não for da árvore.
export function runeSlotIndex(tree: RuneTree, runeId: string): number {
  return tree.slots.findIndex((slot) => slot.some((rune) => rune.id === runeId));
}

// Regras da página de runas do jogo: as runas precisam pertencer às árvores escolhidas,
// uma por linha na primária e de linhas diferentes na secundária.
function validateRunes(runes: RawRunes, trees: ReadonlyMap<string, RuneTree>): string[] {
  const problems: string[] = [];
  const primary = trees.get(runes.primaryTreeId);
  const secondary = trees.get(runes.secondaryTreeId);

  if (!primary) {
    problems.push(`Árvore de runas primária desconhecida: ${runes.primaryTreeId}.`);
  } else {
    if (!primary.keystones.some((rune) => rune.id === runes.keystoneId)) {
      problems.push(`A runa principal ${runes.keystoneId} não pertence à árvore ${primary.name}.`);
    }
    problems.push(...validateSlots(primary, runes.primaryRuneIds, PRIMARY_RUNES, 'primária'));
  }

  if (!secondary) {
    problems.push(`Árvore de runas secundária desconhecida: ${runes.secondaryTreeId}.`);
  } else if (secondary.id === runes.primaryTreeId) {
    problems.push('A árvore secundária deve ser diferente da primária.');
  } else {
    problems.push(
      ...validateSlots(secondary, runes.secondaryRuneIds, SECONDARY_RUNES, 'secundária'),
    );
  }

  return problems;
}

function validateSlots(tree: RuneTree, runeIds: string[], expected: number, label: string) {
  const slots = runeIds.map((id) => runeSlotIndex(tree, id));
  const outside = runeIds.filter((_, index) => slots[index] === -1);
  if (outside.length > 0) {
    return [`Runas que não pertencem à árvore ${label} (${tree.name}): ${outside.join(', ')}.`];
  }
  if (runeIds.length !== expected || new Set(slots).size !== runeIds.length) {
    return [`A árvore ${label} deve ter ${expected} runas, cada uma de uma linha diferente.`];
  }
  return [];
}

// Mesmo com o schema enviado à IA, a resposta é conferida aqui: nada não validado chega ao jogador.
export function validateRecommendation(
  raw: unknown,
  { items, starterItems, lane, enemyIds, runeTrees, requireSkillPriority = false }: Rules,
): ValidationResult {
  const parsed = rawRecommendationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, problems: ['A resposta não segue o formato JSON esperado.'] };
  }

  const recommendation = parsed.data;
  const problems: string[] = [];

  const itemIds = recommendation.items.map((item) => item.itemId);
  if (itemIds.length !== BUILD_SIZE) {
    problems.push(
      `A build deve ter exatamente ${BUILD_SIZE} itens (recebidos: ${itemIds.length}).`,
    );
  }

  const unknownItems = itemIds.filter((id) => !items.has(id));
  if (unknownItems.length > 0) {
    problems.push(`Itens fora da lista permitida: ${unknownItems.join(', ')}.`);
  }

  const repeatedItems = duplicates(itemIds);
  if (repeatedItems.length > 0) {
    problems.push(`Itens repetidos: ${repeatedItems.join(', ')}.`);
  }

  const boots = itemIds.filter((id) => items.get(id)?.isBoots).length;
  if (boots > MAX_BOOTS) {
    problems.push(`A build tem ${boots} pares de botas; o máximo é ${MAX_BOOTS}.`);
  }

  const threatIds = recommendation.threats.map((threat) => threat.championId);
  if (threatIds.length === 0) {
    problems.push('Informe ao menos uma ameaça considerada.');
  }

  const unknownThreats = threatIds.filter((id) => !enemyIds.has(id));
  if (unknownThreats.length > 0) {
    problems.push(`Ameaças que não estão entre os adversários: ${unknownThreats.join(', ')}.`);
  }

  const repeatedThreats = duplicates(threatIds);
  if (repeatedThreats.length > 0) {
    problems.push(`Ameaças repetidas: ${repeatedThreats.join(', ')}.`);
  }

  problems.push(...validateStarterItems(recommendation.starter.itemIds, lane, starterItems));
  problems.push(...validateRunes(recommendation.runes, runeTrees));

  if (requireSkillPriority) {
    const order = recommendation.skillPriority?.order ?? [];
    if (order.length !== 3 || new Set(order).size !== 3 || order.includes('R')) {
      problems.push('A prioridade de habilidades deve ter Q, W e E, cada uma uma vez.');
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: recommendation };
}
