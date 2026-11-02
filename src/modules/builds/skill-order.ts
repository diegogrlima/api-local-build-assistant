import type { ChampionSpell } from '../champions/champion-details.js';
import type { SkillKey } from '../high-elo/match-sample.js';

export const MAX_LEVEL = 18;
const BASIC_SKILLS: SkillKey[] = ['Q', 'W', 'E'];
const STANDARD_RANKS: Record<SkillKey, number> = { Q: 5, W: 5, E: 5, R: 3 };

// Só campeões com os pontos padrão (5/5/5/3) seguem as regras abaixo; Udyr, Jayce, Elise e
// outros têm regras próprias que o Data Dragon não descreve.
export function hasStandardSkillRanks(spells: ChampionSpell[]): boolean {
  return (
    spells.length === 4 && spells.every((spell) => spell.maxRank === STANDARD_RANKS[spell.key])
  );
}

// Pontos permitidos na ultimate: 1 no nível 6, 2 no 11 e 3 no 16.
function ultimateCap(level: number): number {
  return level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;
}

// Completa a sequência até o nível 18 seguindo as regras do jogo: ultimate assim que liberada,
// as três básicas abertas até o nível 3 e, depois, a prioridade para maximizar. Uma básica tem
// no máximo metade do nível (arredondado para cima) em pontos.
export function completeSkillOrder(levels: SkillKey[], priority: SkillKey[]): SkillKey[] {
  const sequence = levels.slice(0, MAX_LEVEL);
  const points = (key: SkillKey) => sequence.filter((k) => k === key).length;
  const order = [...priority, ...BASIC_SKILLS.filter((key) => !priority.includes(key))];

  while (sequence.length < MAX_LEVEL) {
    const level = sequence.length + 1;
    const basicCap = Math.ceil(level / 2);
    const allowed = order.filter(
      (key) => points(key) < STANDARD_RANKS[key] && points(key) < basicCap,
    );
    const unlock = level <= 3 ? allowed.find((key) => points(key) === 0) : undefined;

    const next = points('R') < ultimateCap(level) ? 'R' : (unlock ?? allowed[0]);
    if (!next) break;
    sequence.push(next);
  }
  return sequence;
}
