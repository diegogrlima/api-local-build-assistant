import { describe, expect, it } from 'vitest';
import { createValidAdvisorResponse, testItems } from '../../../../test/fake-providers.js';
import { validateRecommendation } from '../../recommendation-validator.js';

const rules = {
  items: new Map(testItems.map((item) => [item.id, item])),
  enemyIds: new Set(['2', '3', '4', '5', '6']),
};

function withItems(itemIds: string[]) {
  return {
    ...createValidAdvisorResponse(),
    items: itemIds.map((itemId) => ({ itemId, reason: 'Motivo.' })),
  };
}

function problemsOf(raw: unknown): string[] {
  const result = validateRecommendation(raw, rules);
  return result.ok ? [] : result.problems;
}

describe('validateRecommendation', () => {
  it('aceita uma resposta válida', () => {
    const result = validateRecommendation(createValidAdvisorResponse(), rules);

    expect(result.ok).toBe(true);
  });

  it.each([
    ['texto que não é JSON', 'isto não é json'],
    ['objeto sem campos', {}],
    ['justificativa vazia', { ...createValidAdvisorResponse(), justification: '  ' }],
  ])('rejeita formato inválido (%s)', (_caso, raw) => {
    expect(problemsOf(raw)).toEqual(['A resposta não segue o formato JSON esperado.']);
  });

  it('rejeita build com menos de 6 itens', () => {
    expect(problemsOf(withItems(['3006', '3031']))).toContainEqual(
      expect.stringContaining('exatamente 6 itens'),
    );
  });

  it('rejeita itens que não estão no catálogo (inventados)', () => {
    const problems = problemsOf(withItems(['3006', '3031', '3033', '3036', '3072', '9999']));

    expect(problems).toEqual(['Itens fora da lista permitida: 9999.']);
  });

  it('rejeita itens repetidos', () => {
    const problems = problemsOf(withItems(['3006', '3031', '3031', '3036', '3072', '3026']));

    expect(problems).toEqual(['Itens repetidos: 3031.']);
  });

  it('rejeita mais de um par de botas', () => {
    const problems = problemsOf(withItems(['3006', '3111', '3031', '3036', '3072', '3026']));

    expect(problems).toEqual(['A build tem 2 pares de botas; o máximo é 1.']);
  });

  it('rejeita ameaças que não estão entre os adversários', () => {
    const raw = {
      ...createValidAdvisorResponse(),
      threats: [{ championId: '1', reason: 'É o próprio jogador.' }],
    };

    expect(problemsOf(raw)).toEqual(['Ameaças que não estão entre os adversários: 1.']);
  });

  it('rejeita resposta sem ameaças', () => {
    expect(problemsOf({ ...createValidAdvisorResponse(), threats: [] })).toEqual([
      'Informe ao menos uma ameaça considerada.',
    ]);
  });

  it('usa lista vazia quando a IA omite os avisos', () => {
    const raw: Record<string, unknown> = createValidAdvisorResponse();
    delete raw.warnings;
    const result = validateRecommendation(raw, rules);

    expect(result).toMatchObject({ ok: true, value: { warnings: [] } });
  });
});
