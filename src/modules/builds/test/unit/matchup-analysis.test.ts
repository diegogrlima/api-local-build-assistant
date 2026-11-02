import { describe, expect, it } from 'vitest';
import { createChampionDetails } from '../../../../test/fake-providers.js';
import type { ChampionDetails, ChampionSignals } from '../../../champions/champion-details.js';
import { analyzeEnemyTeam, primaryDamage } from '../../matchup-analysis.js';

function champion(
  name: string,
  signals: Partial<ChampionSignals> = {},
  extra: Partial<ChampionDetails> = {},
): ChampionDetails {
  const base = createChampionDetails({ id: name, name });
  return { ...base, ...extra, signals: { ...base.signals, ...signals } };
}

describe('primaryDamage', () => {
  it('classifica pelo tipo de dano que mais aparece nas habilidades', () => {
    expect(primaryDamage(champion('Zed', { physicalDamage: 4 }))).toBe('physical');
    expect(primaryDamage(champion('Lux', { magicDamage: 5, physicalDamage: 1 }))).toBe('magic');
  });

  it('considera misto quando os dois tipos aparecem de forma parecida', () => {
    expect(primaryDamage(champion('Kayle', { physicalDamage: 3, magicDamage: 3 }))).toBe('mixed');
  });

  it('dá peso ao ataque básico dos atiradores', () => {
    const signals = { physicalDamage: 1, magicDamage: 1 };

    expect(primaryDamage(champion('Sem classe', signals))).toBe('mixed');
    expect(primaryDamage(champion('Jinx', signals, { tags: ['Marksman'] }))).toBe('physical');
  });

  it('usa as notas de ataque e magia quando não há sinais', () => {
    const mage = champion('Mago', {}, { info: { attack: 2, defense: 3, magic: 9, difficulty: 5 } });

    expect(primaryDamage(mage)).toBe('magic');
  });
});

describe('analyzeEnemyTeam', () => {
  const enemies = [
    champion('Zed', { physicalDamage: 4 }, { tags: ['Assassin'] }),
    champion('Talon', { physicalDamage: 3 }, { tags: ['Assassin'] }),
    champion('Draven', { physicalDamage: 3 }, { tags: ['Marksman'] }),
    champion('Soraka', { magicDamage: 3, healing: 4, crowdControl: 3 }, { tags: ['Support'] }),
    champion(
      'Malphite',
      { physicalDamage: 2, magicDamage: 5, crowdControl: 3 },
      { tags: ['Tank'] },
    ),
  ];

  it('identifica o tipo de dano dominante', () => {
    expect(analyzeEnemyTeam(enemies).damage).toEqual({
      physical: 3,
      magic: 2,
      mixed: 0,
      dominant: 'balanced',
    });
  });

  it('destaca curandeiros, controle de grupo, dano explosivo e tanques', () => {
    const analysis = analyzeEnemyTeam(enemies);

    expect(analysis.healers).toEqual(['Soraka']);
    expect(analysis.crowdControl).toEqual(['Soraka', 'Malphite']);
    expect(analysis.burst).toEqual(['Zed', 'Talon']);
    expect(analysis.tanks).toEqual(['Malphite']);
  });

  it('marca dano físico dominante quando a diferença é grande', () => {
    const physicalTeam = enemies.slice(0, 3).concat(champion('Garen', { physicalDamage: 3 }));

    expect(analyzeEnemyTeam(physicalTeam).damage.dominant).toBe('physical');
  });
});
