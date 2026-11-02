export type Item = {
  id: string;
  name: string;
  // Resumo curto do item, ex.: "Aprimora drasticamente os acertos críticos".
  plaintext: string;
  // Descrição completa (atributos e efeitos) sem as tags HTML do Data Dragon.
  description: string;
  gold: number;
  tags: string[];
  isBoots: boolean;
  // Item completo ou botas que a IA pode recomendar. Os demais (iniciais, componentes,
  // consumíveis) só aparecem no caminho da build.
  isBuildItem: boolean;
  // Componentes diretos da receita (com repetição, ex.: duas Espadas Longas).
  from: string[];
  icon: string;
};
