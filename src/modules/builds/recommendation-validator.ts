import { z } from 'zod';
import type { Item } from '../items/item.js';
import { BUILD_SIZE, MAX_BOOTS } from './recommendation-prompt.js';

const rawRecommendationSchema = z.object({
  threats: z.array(z.object({ championId: z.string(), reason: z.string().trim().min(1) })),
  items: z.array(z.object({ itemId: z.string(), reason: z.string().trim().min(1) })),
  justification: z.string().trim().min(1),
  balance: z.string().trim().min(1),
  warnings: z.array(z.string()).default([]),
});

export type RawRecommendation = z.infer<typeof rawRecommendationSchema>;

export type ValidationResult =
  { ok: true; value: RawRecommendation } | { ok: false; problems: string[] };

type Rules = {
  items: ReadonlyMap<string, Item>;
  enemyIds: ReadonlySet<string>;
};

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

// Mesmo com o schema enviado à IA, a resposta é conferida aqui: nada não validado chega ao jogador.
export function validateRecommendation(raw: unknown, { items, enemyIds }: Rules): ValidationResult {
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

  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: recommendation };
}
