import { describe, expect, it } from 'vitest';
import {
  createValidAdvisorResponse,
  createValidRunes,
  testItems,
  testRuneTrees,
} from '../../../../test/fake-providers.js';
import type { Lane } from '../../../champions/lane.js';
import { validateRecommendation } from '../../recommendation-validator.js';
import { starterCandidates } from '../../starter-items.js';

const rules = {
  items: new Map(testItems.filter((item) => item.isBuildItem).map((item) => [item.id, item])),
  starterItems: new Map(starterCandidates(testItems).map((item) => [item.id, item])),
  lane: 'top' as Lane,
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

  describe('compra inicial', () => {
    function problemsFor(itemIds: string[], lane: Lane) {
      const raw = { ...createValidAdvisorResponse(), starter: { itemIds, reason: 'Motivo.' } };
      const result = validateRecommendation(raw, { ...rules, lane });
      return result.ok ? [] : result.problems;
    }

    it('aceita itens repetidos dentro do ouro inicial', () => {
      expect(problemsFor(['1036', '2003', '2003'], 'top')).toEqual([]);
    });

    it.each<[string, string[], Lane, string]>([
      ['acima do ouro inicial', ['1055', '1101'], 'jungle', 'custa 900 de ouro'],
      ['item fora da lista', ['3031'], 'top', 'fora da lista permitida'],
      ['selva sem companheiro', ['2003'], 'jungle', 'exatamente 1 companheiro'],
      [
        'companheiro fora da selva',
        ['1101'],
        'top',
        'só podem ser comprados por quem joga na selva',
      ],
      ['suporte sem item de suporte', ['2003'], 'support', 'exatamente 1 item de suporte'],
      [
        'item de suporte fora do suporte',
        ['3865'],
        'mid',
        'só deve ser comprado por quem joga no suporte',
      ],
    ])('rejeita %s', (_caso, itemIds, lane, message) => {
      expect(problemsFor(itemIds, lane).join(' ')).toContain(message);
    });

    it('aceita o companheiro na selva e o item de suporte no suporte', () => {
      expect(problemsFor(['1101', '2003'], 'jungle')).toEqual([]);
      expect(problemsFor(['3865', '2003', '2003'], 'support')).toEqual([]);
    });
  });

  describe('prioridade de habilidades', () => {
    function problemsFor(order: string[] | undefined) {
      const raw = {
        ...createValidAdvisorResponse(),
        skillPriority: order && { order, reason: 'Motivo.' },
      };
      const result = validateRecommendation(raw, { ...rules, requireSkillPriority: true });
      return result.ok ? [] : result.problems;
    }

    it('aceita Q, W e E em qualquer ordem', () => {
      expect(problemsFor(['E', 'Q', 'W'])).toEqual([]);
    });

    it.each([
      ['ausente', undefined],
      ['com repetição', ['Q', 'Q', 'E']],
      ['com a ultimate', ['Q', 'E', 'R']],
    ])('rejeita prioridade %s', (_caso, order) => {
      expect(problemsFor(order).join(' ')).toContain('Q, W e E');
    });
  });
});
