import type { ChampionDetails } from '../champions/champion-details.js';
import type { Item } from '../items/item.js';
import { analyzeEnemyTeam, primaryDamage } from './matchup-analysis.js';

export const BUILD_SIZE = 6;
export const MAX_BOOTS = 1;

export type RecommendationContext = {
  champion: ChampionDetails;
  enemies: ChampionDetails[];
  items: Item[];
};

export const SYSTEM_INSTRUCTION = `Você é um analista de builds de League of Legends.
Recomende UMA build para o campeão do jogador, adaptada aos cinco adversários informados.

Regras obrigatórias:
1. Use somente itens da lista "itensPermitidos", referenciados pelo "id". Nunca cite itens fora dela.
2. Não invente dados. Use apenas os atributos, efeitos e habilidades presentes no contexto.
   Não cite números de patch, porcentagens ou mecânicas que não estejam no contexto.
3. Recomende exatamente ${BUILD_SIZE} itens, na ordem de compra, com no máximo ${MAX_BOOTS} par de botas.
4. Estilo Adaptive: considere a composição inimiga inteira e o papel do campeão do jogador.
   - Muito dano mágico ou físico: avalie a proteção adequada contra esse tipo de dano.
   - Muita cura: avalie itens com redução de cura, se houver algum na lista.
   - Muito controle de grupo: avalie formas de lidar com ele (ex.: tenacidade).
   - Muito dano explosivo: avalie itens que aumentem a sobrevivência.
   Esses são critérios de análise, não regras fixas.
5. Equilibre força (dano e cumprimento do papel) e proteção. Não monte uma build só defensiva
   para um campeão cujo papel é causar dano, nem só ofensiva contra uma composição muito perigosa.
6. Justifique cada item citando os adversários específicos. Evite justificativas genéricas.
7. Nunca afirme que a build garante a vitória.
8. Escreva em português do Brasil, em linguagem simples e direta.
9. Se as informações do contexto não bastarem para sustentar alguma escolha, explique em "warnings".`;

function describeChampion(champion: ChampionDetails) {
  return {
    id: champion.id,
    nome: champion.name,
    titulo: champion.title,
    classes: champion.tags,
    recurso: champion.resource,
    notas: champion.info,
    danoPrincipal: primaryDamage(champion),
    sinais: champion.signals,
    passiva: champion.passive,
    habilidades: champion.spells,
  };
}

export function buildPrompt({ champion, enemies, items }: RecommendationContext): string {
  const context = {
    campeaoDoJogador: { ...describeChampion(champion), dicas: champion.allyTips },
    adversarios: enemies.map((enemy) => ({
      ...describeChampion(enemy),
      dicasContra: enemy.enemyTips,
    })),
    analiseDaComposicaoInimiga: analyzeEnemyTeam(enemies),
    itensPermitidos: items.map((item) => ({
      id: item.id,
      nome: item.name,
      ouro: item.gold,
      botas: item.isBoots,
      categorias: item.tags,
      resumo: item.plaintext,
      descricao: item.description,
    })),
  };

  return [
    'Contexto da partida (JSON). "sinais" conta quantas vezes cada efeito aparece nas habilidades;',
    'é uma aproximação, não um valor exato.',
    '',
    JSON.stringify(context),
  ].join('\n');
}

// Os enums restringem a resposta da IA aos itens permitidos e aos adversários informados.
export function buildResponseSchema(itemIds: string[], enemyIds: string[]) {
  return {
    type: 'object',
    properties: {
      threats: {
        type: 'array',
        description: 'Adversários ou características que mais influenciaram a build.',
        minItems: 1,
        maxItems: enemyIds.length,
        items: {
          type: 'object',
          properties: {
            championId: { type: 'string', enum: enemyIds },
            reason: { type: 'string', description: 'Por que este adversário é uma ameaça.' },
          },
          required: ['championId', 'reason'],
        },
      },
      items: {
        type: 'array',
        description: `Exatamente ${BUILD_SIZE} itens, na ordem de compra.`,
        minItems: BUILD_SIZE,
        maxItems: BUILD_SIZE,
        items: {
          type: 'object',
          properties: {
            itemId: { type: 'string', enum: itemIds },
            reason: {
              type: 'string',
              description: 'Por que este item, citando os adversários específicos.',
            },
          },
          required: ['itemId', 'reason'],
        },
      },
      justification: {
        type: 'string',
        description: 'Por que a build é adequada contra os adversários informados.',
      },
      balance: {
        type: 'string',
        description: 'Como a build equilibra força e proteção.',
      },
      warnings: {
        type: 'array',
        description: 'Limitações da análise por falta de informação. Pode ser vazio.',
        items: { type: 'string' },
      },
    },
    required: ['threats', 'items', 'justification', 'balance', 'warnings'],
    // Pede a análise das ameaças antes da escolha dos itens.
    propertyOrdering: ['threats', 'items', 'justification', 'balance', 'warnings'],
  };
}
