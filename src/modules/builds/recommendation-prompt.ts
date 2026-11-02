import type { ChampionDetails } from '../champions/champion-details.js';
import { LANE_NAMES, type Lane } from '../champions/lane.js';
import type { Item } from '../items/item.js';
import type { RuneTree } from '../runes/rune.js';
import type { HighEloSummary, Usage } from '../high-elo/high-elo-stats.js';
import type { RunePage } from '../high-elo/match-sample.js';
import { analyzeEnemyTeam, primaryDamage } from './matchup-analysis.js';
import { isJungleCompanion, isSupportItem, STARTING_GOLD } from './starter-items.js';

export const BUILD_SIZE = 6;
export const MAX_BOOTS = 1;

// Runas menores por árvore: uma de cada linha na primária e duas de linhas diferentes na secundária.
export const PRIMARY_RUNES = 3;
export const SECONDARY_RUNES = 2;

// Abaixo disso, as estatísticas de alto elo são só um indício fraco.
export const MIN_RELIABLE_MATCHES = 20;
export const MIN_RELIABLE_MATCHES_VERSUS = 8;

export type LanedDetails = ChampionDetails & { lane: Lane };

export type RecommendationContext = {
  champion: LanedDetails;
  enemies: LanedDetails[];
  items: Item[];
  // Itens permitidos na compra inicial (Doran, poções, companheiro da selva...).
  starterItems: Item[];
  runeTrees: RuneTree[];
  // null quando não há partidas de alto elo desse campeão nessa rota.
  highElo: HighEloSummary | null;
  // true quando as partidas de alto elo não trazem a ordem de habilidades do campeão.
  skillOrderFromAi?: boolean;
};

export const SYSTEM_INSTRUCTION = `Você é um analista de builds de League of Legends.
Recomende UMA build e UMA página de runas para o campeão do jogador, adaptadas aos cinco
adversários informados e às rotas de cada um.

Regras obrigatórias:
1. Use somente itens da lista "itensPermitidos", referenciados pelo "id". Nunca cite itens fora dela.
2. Não invente dados. Use apenas os atributos, efeitos e habilidades presentes no contexto.
   Não cite números de patch, porcentagens ou mecânicas que não estejam no contexto.
   Os únicos números de partidas que você pode citar são os de "dadosAltoElo".
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
    Justifique as runas pelo campeão do jogador, pela rota e pelo oponente direto.
12. "dadosAltoElo" são estatísticas reais de partidas ranqueadas solo/duo de jogadores Challenger e
    Grão-Mestre jogando o campeão do jogador na mesma rota. Use-as como base principal da build e das runas:
    - Parta dos itens e das páginas de runas mais usados por esses jogadores e adapte à composição inimiga.
    - "contraAdversarios" mostra o que eles usaram contra cada adversário informado: pese mais o oponente direto.
    - Ao trocar uma escolha frequente no alto elo por outra, explique o motivo citando os adversários.
    - Taxa de uso pesa mais que taxa de vitória; com poucas partidas, a taxa de vitória varia muito.
    - Quando "amostraConfiavel" for false, use os dados só como indício e avise em "warnings".
    - Se "dadosAltoElo" for null, avise em "warnings" que a recomendação não se baseia em partidas de alto elo.
    Cite os dados de alto elo na justificativa quando eles sustentarem a escolha.
13. Compra inicial ("starter"): escolha os itens comprados no início da partida usando só
    "itensIniciaisPermitidos" (pode repetir, ex.: 2 poções), com custo total de até ${STARTING_GOLD} de ouro.
    - Na selva, inclua exatamente 1 companheiro da selva ("companheiroDaSelva": true); fora dela, nenhum.
    - No suporte, inclua exatamente 1 item de suporte ("itemDeSuporte": true); fora dele, nenhum.
    - Nas demais rotas, escolha o item inicial adequado ao campeão e ao oponente direto
      (ex.: Anel de Doran para conjuradores, Lâmina de Doran para atacantes, Escudo de Doran contra pressão).
    - Parta de "compraInicialMaisUsada" de "dadosAltoElo" quando existir e explique os desvios.
14. Quando "ordemDeHabilidadesPelaIa" for true, preencha "skillPriority": a ordem para maximizar
    Q, W e E (cada uma uma vez), com base nas "habilidades" do campeão do jogador e no oponente direto.
    Explique em linguagem simples e avise em "warnings" que a ordem não vem de partidas de alto elo.`;

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

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function describeHighElo(
  summary: HighEloSummary,
  { enemies, items, starterItems, runeTrees }: Omit<RecommendationContext, 'champion' | 'highElo'>,
) {
  const itemNames = new Map([...items, ...starterItems].map((item) => [item.id, item.name]));
  const treeNames = new Map(runeTrees.map((tree) => [tree.id, tree.name]));
  const runeNames = new Map(
    runeTrees
      .flatMap((tree) => [...tree.keystones, ...tree.slots.flat()])
      .map((r) => [r.id, r.name]),
  );
  const enemyNames = new Map(enemies.map((enemy) => [enemy.id, enemy.name]));

  const rates = ({ matches, wins }: Usage, total: number) => ({
    partidas: matches,
    taxaDeUsoPct: percent(matches, total),
    taxaDeVitoriaPct: percent(wins, matches),
  });
  const describeItems = (list: HighEloSummary['items'], total: number) =>
    list.map((usage) => ({
      id: usage.itemId,
      nome: itemNames.get(usage.itemId),
      ...rates(usage, total),
    }));
  const describePage = (page: RunePage) => ({
    arvorePrimaria: { id: page.primaryTreeId, nome: treeNames.get(page.primaryTreeId) },
    runaPrincipal: { id: page.keystoneId, nome: runeNames.get(page.keystoneId) },
    runasPrimarias: page.primaryRuneIds.map((id) => ({ id, nome: runeNames.get(id) })),
    arvoreSecundaria: { id: page.secondaryTreeId, nome: treeNames.get(page.secondaryTreeId) },
    runasSecundarias: page.secondaryRuneIds.map((id) => ({ id, nome: runeNames.get(id) })),
  });

  return {
    fonte: 'Partidas ranqueadas solo/duo de jogadores Challenger e Grão-Mestre',
    patches: summary.patches,
    partidas: summary.matches,
    taxaDeVitoriaPct: percent(summary.wins, summary.matches),
    amostraConfiavel: summary.matches >= MIN_RELIABLE_MATCHES,
    itensMaisUsados: describeItems(summary.items, summary.matches),
    // Só existe quando há partidas com a linha do tempo de compras.
    compraInicialMaisUsada:
      summary.buildPath && summary.buildPath.starterItems.length > 0
        ? {
            itens: summary.buildPath.starterItems.map((id) => ({ id, nome: itemNames.get(id) })),
            partidas: summary.buildPath.starterMatches,
            taxaDeUsoPct: percent(summary.buildPath.starterMatches, summary.buildPath.matches),
          }
        : null,
    runasPrincipaisMaisUsadas: summary.keystones.map((usage) => ({
      id: usage.keystoneId,
      nome: runeNames.get(usage.keystoneId),
      arvore: treeNames.get(usage.primaryTreeId),
      ...rates(usage, summary.matches),
    })),
    paginasDeRunasMaisUsadas: summary.runePages.map((usage) => ({
      ...describePage(usage.page),
      ...rates(usage, summary.matches),
    })),
    contraAdversarios: summary.versusEnemies.map((versus) => ({
      adversario: enemyNames.get(versus.championId),
      oponenteDireto: versus.laneOpponent,
      partidas: versus.matches,
      taxaDeVitoriaPct: percent(versus.wins, versus.matches),
      amostraConfiavel: versus.matches >= MIN_RELIABLE_MATCHES_VERSUS,
      itensMaisUsados: describeItems(versus.items, versus.matches),
    })),
  };
}

export function buildPrompt({
  champion,
  enemies,
  items,
  starterItems,
  runeTrees,
  highElo,
  skillOrderFromAi = false,
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
    itensIniciaisPermitidos: starterItems.map((item) => ({
      id: item.id,
      nome: item.name,
      ouro: item.gold,
      categorias: item.tags,
      companheiroDaSelva: isJungleCompanion(item),
      itemDeSuporte: isSupportItem(item),
      descricao: item.description,
    })),
    arvoresDeRunas: runeTrees.map((tree) => ({
      id: tree.id,
      nome: tree.name,
      runasPrincipais: tree.keystones.map(describeRune),
      linhas: tree.slots.map((slot) => slot.map(describeRune)),
    })),
    ordemDeHabilidadesPelaIa: skillOrderFromAi,
    dadosAltoElo: highElo && describeHighElo(highElo, { enemies, items, starterItems, runeTrees }),
  };

  return [
    'Contexto da partida (JSON). "sinais" conta quantas vezes cada efeito aparece nas habilidades;',
    'é uma aproximação, não um valor exato. Em "dadosAltoElo", os itens são os do inventário ao fim',
    'da partida (sem ordem de compra) e as taxas são porcentagens das partidas daquele grupo.',
    '',
    JSON.stringify(context),
  ].join('\n');
}

// Os enums restringem a resposta da IA aos itens, runas e adversários informados.
export function buildResponseSchema(
  itemIds: string[],
  enemyIds: string[],
  runeTrees: RuneTree[],
  starterItemIds: string[],
  { skillPriority = false }: { skillPriority?: boolean } = {},
) {
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
      starter: {
        type: 'object',
        properties: {
          itemIds: {
            type: 'array',
            description: `Compra inicial, até ${STARTING_GOLD} de ouro; itens podem se repetir.`,
            minItems: 1,
            maxItems: 6,
            items: { type: 'string', enum: starterItemIds },
          },
          reason: {
            type: 'string',
            description:
              'Por que esta compra inicial, citando o campeão, a rota e o oponente direto.',
          },
        },
        required: ['itemIds', 'reason'],
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
      ...(skillPriority && {
        skillPriority: {
          type: 'object',
          properties: {
            order: {
              type: 'array',
              description: 'Ordem para maximizar as habilidades básicas, ex.: ["Q", "E", "W"].',
              minItems: 3,
              maxItems: 3,
              items: { type: 'string', enum: ['Q', 'W', 'E'] },
            },
            reason: { type: 'string', description: 'Por que esta ordem de habilidades.' },
          },
          required: ['order', 'reason'],
        },
      }),
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
    required: [
      'threats',
      'starter',
      'items',
      'runes',
      ...(skillPriority ? ['skillPriority'] : []),
      'justification',
      'balance',
      'warnings',
    ],
    // Pede a análise das ameaças antes da escolha dos itens e das runas.
    propertyOrdering: [
      'threats',
      'starter',
      'items',
      'runes',
      ...(skillPriority ? ['skillPriority'] : []),
      'justification',
      'balance',
      'warnings',
    ],
  };
}
