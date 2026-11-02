export type Rune = {
  id: string;
  name: string;
  // Descrição curta do efeito, sem as tags HTML do Data Dragon.
  description: string;
  icon: string;
};

// Uma árvore (Precisão, Dominação...): a primeira linha são as runas principais (keystones)
// e as demais são as linhas de runas menores, das quais se escolhe uma por linha.
export type RuneTree = {
  id: string;
  name: string;
  icon: string;
  keystones: Rune[];
  slots: Rune[][];
};
