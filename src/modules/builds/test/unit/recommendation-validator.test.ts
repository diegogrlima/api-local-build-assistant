import { describe, expect, it } from 'vitest';
import {
  createValidAdvisorResponse,
  createValidRunes,
  testItems,
  testRuneTrees,
} from '../../../../test/fake-providers.js';
import { validateRecommendation } from '../../recommendation-validator.js';

const rules = {
  items: new Map(testItems.map((item) => [item.id, item])),
  enemyIds: new Set(['2', '3', '4', '5', '6']),
  runeTrees: new Map(testRuneTrees.map((tree) => [tree.id, tree])),
};

function withRunes(overrides: Partial<ReturnType<typeof createValidRunes>>) {
  return { ...createValidAdvisorResponse(), runes: { ...createValidRunes(), ...overrides } };
}

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

  describe('runas', () => {
    it('rejeita árvore primária desconhecida (inventada)', () => {
      expect(problemsOf(withRunes({ primaryTreeId: '9999' }))).toEqual([
        'Árvore de runas primária desconhecida: 9999.',
      ]);
    });

    it('rejeita runa principal de outra árvore', () => {
      expect(problemsOf(withRunes({ keystoneId: '8112' }))).toEqual([
        'A runa principal 8112 não pertence à árvore Precisão.',
      ]);
    });

    it('rejeita runas menores que não são da árvore primária', () => {
      expect(problemsOf(withRunes({ primaryRuneIds: ['9111', '9104', '8135'] }))).toEqual([
        'Runas que não pertencem à árvore primária (Precisão): 8135.',
      ]);
    });

    it('rejeita duas runas da mesma linha na árvore primária', () => {
      expect(problemsOf(withRunes({ primaryRuneIds: ['9111', '8009', '8014'] }))).toEqual([
        'A árvore primária deve ter 3 runas, cada uma de uma linha diferente.',
      ]);
    });

    it('rejeita a mesma árvore como primária e secundária', () => {
      expect(problemsOf(withRunes({ secondaryTreeId: '8000' }))).toEqual([
        'A árvore secundária deve ser diferente da primária.',
      ]);
    });

    it('rejeita runa principal na árvore secundária', () => {
      expect(problemsOf(withRunes({ secondaryRuneIds: ['8112', '8135'] }))).toEqual([
        'Runas que não pertencem à árvore secundária (Dominação): 8112.',
      ]);
    });

    it('rejeita duas runas da mesma linha na árvore secundária', () => {
      expect(problemsOf(withRunes({ secondaryRuneIds: ['8126', '8139'] }))).toEqual([
        'A árvore secundária deve ter 2 runas, cada uma de uma linha diferente.',
      ]);
    });

    it('rejeita resposta sem runas', () => {
      const raw: Record<string, unknown> = createValidAdvisorResponse();
      delete raw.runes;

      expect(problemsOf(raw)).toEqual(['A resposta não segue o formato JSON esperado.']);
    });
  });
});
