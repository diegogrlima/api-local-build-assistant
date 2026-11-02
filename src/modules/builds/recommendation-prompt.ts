import type { ChampionDetails } from '../champions/champion-details.js';
import { LANE_NAMES, type Lane } from '../champions/lane.js';
import type { Item } from '../items/item.js';
import type { RuneTree } from '../runes/rune.js';
import { analyzeEnemyTeam, primaryDamage } from './matchup-analysis.js';

export const BUILD_SIZE = 6;
export const MAX_BOOTS = 1;

// Runas menores por árvore: uma de cada linha na primária e duas de linhas diferentes na secundária.
export const PRIMARY_RUNES = 3;
export const SECONDARY_RUNES = 2;

export type LanedDetails = ChampionDetails & { lane: Lane };

export type RecommendationContext = {
  champion: LanedDetails;
  enemies: LanedDetails[];
  items: Item[];
  runeTrees: RuneTree[];
};

export const SYSTEM_INSTRUCTION = `Você é um analista de builds de League of Legends.
Recomende UMA build e UMA página de runas para o campeão do jogador, adaptadas aos cinco
adversários informados e às rotas de cada um.

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
9. Se as informações do contexto não bastarem para sustentar alguma escolha, explique em "warnings".
10. Considere a rota de cada campeão. O "oponenteDireto" é o adversário na mesma rota do jogador:
    pese mais as ameaças dele na fase de rotas, sem ignorar o restante da composição.
11. Runas: use somente as árvores de "arvoresDeRunas", referenciadas pelo "id".
    - Árvore primária: 1 runa de "runasPrincipais" e ${PRIMARY_RUNES} runas, uma de cada linha de "linhas", na ordem das linhas.
    - Árvore secundária, diferente da primária: ${SECONDARY_RUNES} runas de linhas diferentes de "linhas" (nunca de "runasPrincipais").
    Justifique as runas pelo campeão do jogador, pela rota e pelo oponente direto.`;

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

function describeRune(rune: RuneTree['keystones'][number]) {
  return { id: rune.id, nome: rune.name, descricao: rune.description };
}

export function buildPrompt({
  champion,
  enemies,
  items,
  runeTrees,
}: RecommendationContext): string {
  const laneOpponent = enemies.find((enemy) => enemy.lane === champion.lane);
  const context = {
    campeaoDoJogador: {
      ...describeChampion(champion),
      rota: LANE_NAMES[champion.lane],
      dicas: champion.allyTips,
    },
    oponenteDireto: laneOpponent?.name ?? null,
    adversarios: enemies.map((enemy) => ({
      ...describeChampion(enemy),
      rota: LANE_NAMES[enemy.lane],
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
    arvoresDeRunas: runeTrees.map((tree) => ({
      id: tree.id,
      nome: tree.name,
      runasPrincipais: tree.keystones.map(describeRune),
      linhas: tree.slots.map((slot) => slot.map(describeRune)),
    })),
  };

  return [
    'Contexto da partida (JSON). "sinais" conta quantas vezes cada efeito aparece nas habilidades;',
    'é uma aproximação, não um valor exato.',
    '',
    JSON.stringify(context),
  ].join('\n');
}

// Os enums restringem a resposta da IA aos itens, runas e adversários informados.
export function buildResponseSchema(itemIds: string[], enemyIds: string[], runeTrees: RuneTree[]) {
  const treeIds = runeTrees.map((tree) => tree.id);
  const keystoneIds = runeTrees.flatMap((tree) => tree.keystones.map((rune) => rune.id));
  const runeIds = runeTrees.flatMap((tree) => tree.slots.flat().map((rune) => rune.id));

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
      runes: {
        type: 'object',
        properties: {
          primaryTreeId: { type: 'string', enum: treeIds },
          keystoneId: { type: 'string', enum: keystoneIds },
          primaryRuneIds: {
            type: 'array',
            description: `${PRIMARY_RUNES} runas da árvore primária, uma de cada linha.`,
            minItems: PRIMARY_RUNES,
            maxItems: PRIMARY_RUNES,
            items: { type: 'string', enum: runeIds },
          },
          secondaryTreeId: { type: 'string', enum: treeIds },
          secondaryRuneIds: {
            type: 'array',
            description: `${SECONDARY_RUNES} runas da árvore secundária, de linhas diferentes.`,
            minItems: SECONDARY_RUNES,
            maxItems: SECONDARY_RUNES,
            items: { type: 'string', enum: runeIds },
          },
          reason: {
            type: 'string',
            description: 'Por que estas runas, citando a rota e o oponente direto.',
          },
        },
        required: [
          'primaryTreeId',
          'keystoneId',
          'primaryRuneIds',
          'secondaryTreeId',
          'secondaryRuneIds',
          'reason',
        ],
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
    required: ['threats', 'items', 'runes', 'justification', 'balance', 'warnings'],
    // Pede a análise das ameaças antes da escolha dos itens e das runas.
    propertyOrdering: ['threats', 'items', 'runes', 'justification', 'balance', 'warnings'],
  };
}
