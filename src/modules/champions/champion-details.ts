// Quantas vezes cada marcação aparece nos tooltips das habilidades e na passiva.
// São sinais aproximados (ex.: "healing" inclui cura em aliados), não números exatos.
export type ChampionSignals = {
  physicalDamage: number;
  magicDamage: number;
  trueDamage: number;
  healing: number;
  shield: number;
  crowdControl: number;
  stealth: number;
};

export type ChampionSpell = {
  key: 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;
  icon: string;
  // Pontos máximos da habilidade (normalmente 5 nas básicas e 3 na ultimate).
  maxRank: number;
};

export type ChampionDetails = {
  // Mesmo id do catálogo de campeões (a "key" numérica do Data Dragon).
  id: string;
  name: string;
  title: string;
  // Classes do campeão, ex.: ["Fighter", "Assassin"].
  tags: string[];
  // Notas de 0 a 10 do Data Dragon.
  info: { attack: number; defense: number; magic: number; difficulty: number };
  resource: string;
  passive: { name: string; description: string };
  spells: ChampionSpell[];
  allyTips: string[];
  enemyTips: string[];
  signals: ChampionSignals;
};
