import { describe, expect, it } from 'vitest';
import type { ChampionSpell } from '../../../champions/champion-details.js';
import { completeSkillOrder, hasStandardSkillRanks } from '../../skill-order.js';

function spells(ranks: number[]): ChampionSpell[] {
  return (['Q', 'W', 'E', 'R'] as const).map((key, index) => ({
    key,
    name: key,
    description: '',
    icon: `${key}.png`,
    maxRank: ranks[index]!,
  }));
}

describe('completeSkillOrder', () => {
  it('monta os 18 níveis pela prioridade, abrindo as três básicas e a ultimate a tempo', () => {
    expect(completeSkillOrder([], ['Q', 'E', 'W']).join('')).toBe('QEWQQRQEQEREEWWRWW');
  });

  it('mantém os níveis já conhecidos e completa o restante', () => {
    const sequence = completeSkillOrder(['E', 'Q', 'W', 'E'], ['E', 'Q', 'W']);

    expect(sequence.slice(0, 4)).toEqual(['E', 'Q', 'W', 'E']);
    expect(sequence).toHaveLength(18);
    expect(sequence.filter((key) => key === 'E')).toHaveLength(5);
    expect(sequence.filter((key) => key === 'R')).toHaveLength(3);
    expect([sequence[5], sequence[10], sequence[15]]).toEqual(['R', 'R', 'R']);
  });

  it('nunca passa de metade do nível em uma habilidade básica', () => {
    const sequence = completeSkillOrder(['Q'], ['Q', 'W', 'E']);

    sequence.forEach((_, index) => {
      const points = sequence.slice(0, index + 1).filter((key) => key === 'Q').length;
      expect(points).toBeLessThanOrEqual(Math.ceil((index + 1) / 2));
    });
  });
});

describe('hasStandardSkillRanks', () => {
  it('reconhece os pontos padrão e recusa campeões com regras próprias', () => {
    expect(hasStandardSkillRanks(spells([5, 5, 5, 3]))).toBe(true);
    expect(hasStandardSkillRanks(spells([6, 6, 6, 6]))).toBe(false);
    expect(hasStandardSkillRanks(spells([5, 5, 5, 4]))).toBe(false);
  });
});
