// Rotas de Summoner's Rift. Os ids seguem o padrão em inglês; os nomes vão para o jogador e a IA.
export const LANES = ['top', 'jungle', 'mid', 'bot', 'support'] as const;

export type Lane = (typeof LANES)[number];

export const LANE_NAMES: Record<Lane, string> = {
  top: 'Topo',
  jungle: 'Selva',
  mid: 'Meio',
  bot: 'Atirador',
  support: 'Suporte',
};
