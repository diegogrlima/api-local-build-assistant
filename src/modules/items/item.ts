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
  icon: string;
};
