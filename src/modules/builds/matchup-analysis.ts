import type { ChampionDetails } from '../champions/champion-details.js';

export type DamageType = 'physical' | 'magic' | 'mixed';

export type EnemyTeamAnalysis = {
  damage: {
    physical: number;
    magic: number;
    mixed: number;
    dominant: 'physical' | 'magic' | 'balanced';
  };
  // Nomes dos campeões que mais pesam em cada critério do estilo Adaptive.
  healers: string[];
  crowdControl: string[];
  burst: string[];
  tanks: string[];
  shields: string[];
  stealth: string[];
};

// Limiares dos sinais extraídos dos tooltips. São critérios de destaque, não regras de build.
const HEALING_THRESHOLD = 2;
const CROWD_CONTROL_THRESHOLD = 3;
const SHIELD_THRESHOLD = 2;
// Diferença mínima (em campeões) para considerar um tipo de dano dominante.
const DOMINANCE_MARGIN = 2;

// Atiradores causam a maior parte do dano em ataques básicos, que não aparecem nos tooltips.
const MARKSMAN_PHYSICAL_BONUS = 2;

export function primaryDamage(champion: ChampionDetails): DamageType {
  const physical =
    champion.signals.physicalDamage +
    (champion.tags.includes('Marksman') ? MARKSMAN_PHYSICAL_BONUS : 0);
  const magic = champion.signals.magicDamage;

  if (physical === 0 && magic === 0) {
    return champion.info.attack >= champion.info.magic ? 'physical' : 'magic';
  }
  if (physical > 0 && magic > 0 && Math.abs(physical - magic) <= 1) return 'mixed';
  return physical > magic ? 'physical' : 'magic';
}

export function analyzeEnemyTeam(enemies: ChampionDetails[]): EnemyTeamAnalysis {
  const types = enemies.map(primaryDamage);
  const count = (type: DamageType) => types.filter((t) => t === type).length;

  const physical = count('physical');
  const magic = count('magic');
  const mixed = count('mixed');

  const dominant =
    physical >= magic + DOMINANCE_MARGIN
      ? 'physical'
      : magic >= physical + DOMINANCE_MARGIN
        ? 'magic'
        : 'balanced';

  const names = (predicate: (champion: ChampionDetails) => boolean) =>
    enemies.filter(predicate).map((champion) => champion.name);

  return {
    damage: { physical, magic, mixed, dominant },
    healers: names((c) => c.signals.healing >= HEALING_THRESHOLD),
    crowdControl: names((c) => c.signals.crowdControl >= CROWD_CONTROL_THRESHOLD),
    burst: names((c) => c.tags.includes('Assassin')),
    tanks: names((c) => c.tags.includes('Tank')),
    shields: names((c) => c.signals.shield >= SHIELD_THRESHOLD),
    stealth: names((c) => c.signals.stealth > 0),
  };
}
