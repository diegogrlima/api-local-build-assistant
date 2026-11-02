import { AppError } from '../../shared/errors/app-error.js';
import type { Champion } from '../champions/champion.js';
import type { ChampionCatalog } from '../champions/champion-catalog.js';
import type { ChampionDetails, ChampionSpell } from '../champions/champion-details.js';
import { validateMatchupInput, type LanedChampion } from '../champions/matchup-input.js';
import type { Item } from '../items/item.js';
import type { ItemCatalog } from '../items/item-catalog.js';
import type { Rune, RuneTree } from '../runes/rune.js';
import { HIGH_ELO_TIERS } from '../high-elo/high-elo-api.js';
import type {
  HighEloQuery,
  HighEloSummary,
  SkillOrderSummary,
} from '../high-elo/high-elo-stats.js';
import type { Lane } from '../champions/lane.js';
import type { BuildAdvisor } from './build-advisor.js';
import { completeSkillOrder, hasStandardSkillRanks } from './skill-order.js';
import { starterCandidates } from './starter-items.js';
import type { BuildRecommendation } from './build-recommendation.js';
import { buildPrompt, buildResponseSchema, SYSTEM_INSTRUCTION } from './recommendation-prompt.js';
import {
  runeSlotIndex,
  validateRecommendation,
  type RawRecommendation,
} from './recommendation-validator.js';

// Uma tentativa extra quando a IA devolve algo que não passa na validação.
const MAX_ATTEMPTS = 2;

export type ChampionDetailsLookup = {
  getById(id: string): ChampionDetails | undefined;
};

export type RuneTreeSource = {
  getAll(): RuneTree[];
};

export type HighEloSource = {
  summarize(query: HighEloQuery): HighEloSummary | null;
  skillOrder?(query: { championId: string; lane: Lane }): SkillOrderSummary | null;
};

type Dependencies = {
  championCatalog: ChampionCatalog;
  championDetails: ChampionDetailsLookup;
  itemCatalog: ItemCatalog;
  runeCatalog: RuneTreeSource;
  // null quando a IA não está configurada (sem GEMINI_API_KEY).
  advisor: BuildAdvisor | null;
  // null quando a API da Riot não está configurada (sem RIOT_API_KEY).
  highElo?: HighEloSource | null;
};

function toRef({ id, name, icon }: Champion) {
  return { id, name, icon };
}

function toLanedRef({ id, name, icon, lane }: LanedChampion) {
  return { id, name, icon, lane };
}

function toTreeRef({ id, name, icon }: RuneTree) {
  return { id, name, icon };
}

function toRuneRef({ id, name, icon, description }: Rune) {
  return { id, name, icon, description };
}

function findRune(runes: Rune[], id: string): Rune {
  return runes.find((rune) => rune.id === id)!;
}

// Agrupa os itens repetidos (ex.: duas poções, duas Espadas Longas) mantendo a ordem.
function groupItems(ids: string[], itemsById: ReadonlyMap<string, Item>) {
  const grouped = new Map<string, { id: string; name: string; icon: string; count: number }>();
  for (const id of ids) {
    const item = itemsById.get(id);
    if (!item) continue;
    const entry = grouped.get(id) ?? { id, name: item.name, icon: item.icon, count: 0 };
    entry.count++;
    grouped.set(id, entry);
  }
  return [...grouped.values()];
}

type ResponseContext = {
  champion: LanedChampion;
  spells: ChampionSpell[];
  enemies: LanedChampion[];
  catalog: Item[];
  treesById: ReadonlyMap<string, RuneTree>;
  highElo: HighEloSummary | null;
  skillOrder: SkillOrderSummary | null;
};

export class RecommendationService {
  constructor(private readonly deps: Dependencies) {}

  async recommend(input: unknown): Promise<BuildRecommendation> {
    // Entrada inválida nunca chega à IA.
    const { champion, enemies } = await validateMatchupInput(input, this.deps.championCatalog);

    const { advisor } = this.deps;
    if (!advisor) {
      throw new AppError(
        'A recomendação está indisponível: a IA não foi configurada no servidor.',
        503,
        'AI_NOT_CONFIGURED',
      );
    }

    const players = [champion, ...enemies];
    const details = players.map((player) => this.deps.championDetails.getById(player.id));
    const missing = players.filter((_, index) => !details[index]);
    if (missing.length > 0) {
      throw new AppError(
        `Não há informações suficientes sobre ${missing.map((p) => p.name).join(', ')} para recomendar uma build.`,
        503,
        'CHAMPION_DATA_UNAVAILABLE',
      );
    }
    const [championDetails, ...enemyDetails] = (details as ChampionDetails[]).map(
      (detail, index) => ({ ...detail, lane: players[index]!.lane }),
    );

    const catalog = await this.deps.itemCatalog.getAll();
    // Itens iniciais e componentes só entram no caminho da build; a IA escolhe entre os itens de build.
    const items = catalog.filter((item) => item.isBuildItem);
    const shopItems = catalog.filter((item) => !item.isBuildItem);
    const starterItems = starterCandidates(catalog);
    if (items.length === 0) {
      throw new AppError(
        'Não há informações sobre itens para recomendar uma build.',
        503,
        'ITEM_DATA_UNAVAILABLE',
      );
    }
    const runeTrees = this.deps.runeCatalog.getAll();
    if (runeTrees.length === 0) {
      throw new AppError(
        'Não há informações sobre runas para recomendar uma página de runas.',
        503,
        'RUNE_DATA_UNAVAILABLE',
      );
    }

    const itemsById = new Map(items.map((item) => [item.id, item]));
    const treesById = new Map(runeTrees.map((tree) => [tree.id, tree]));
    const enemyIds = enemies.map((enemy) => enemy.id);

    const highElo =
      this.deps.highElo?.summarize({
        championId: champion.id,
        lane: champion.lane,
        enemies: enemies.map((enemy) => ({ championId: enemy.id, lane: enemy.lane })),
        allowedItemIds: new Set(itemsById.keys()),
        starterItemIds: new Set(shopItems.map((item) => item.id)),
      }) ?? null;
    // Sem partidas de alto elo com a ordem de habilidades do campeão, a IA escolhe a prioridade.
    const skillOrder =
      this.deps.highElo?.skillOrder?.({ championId: champion.id, lane: champion.lane }) ?? null;

    const prompt = buildPrompt({
      champion: championDetails!,
      enemies: enemyDetails,
      items,
      starterItems,
      runeTrees,
      highElo,
      skillOrderFromAi: !skillOrder,
    });
    const responseSchema = buildResponseSchema(
      items.map((item) => item.id),
      enemyIds,
      runeTrees,
      starterItems.map((item) => item.id),
      { skillPriority: !skillOrder },
    );

    let feedback = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await advisor.generate({
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: prompt + feedback,
        responseSchema,
      });

      const result = validateRecommendation(raw, {
        items: itemsById,
        starterItems: new Map(starterItems.map((item) => [item.id, item])),
        lane: champion.lane,
        enemyIds: new Set(enemyIds),
        runeTrees: treesById,
        requireSkillPriority: !skillOrder,
      });
      if (result.ok) {
        return this.toResponse(result.value, {
          champion,
          spells: championDetails!.spells,
          enemies,
          catalog,
          treesById,
          highElo,
          skillOrder,
        });
      }

      feedback = `\n\nSua resposta anterior foi rejeitada pelos motivos abaixo. Corrija e responda novamente.\n- ${result.problems.join('\n- ')}`;
    }

    throw new AppError(
      'A IA não gerou uma recomendação válida. Tente novamente.',
      502,
      'RECOMMENDATION_INVALID',
    );
  }

  // Os níveis das partidas vêm primeiro; os demais são completados pela prioridade (das
  // partidas ou, sem elas, da IA, já validada), exceto para campeões com regras próprias.
  private skillOrderResponse(
    skillOrder: SkillOrderSummary | null,
    recommendation: RawRecommendation,
    spells: ChampionSpell[],
  ): BuildRecommendation['skillOrder'] {
    const observed = skillOrder?.levels ?? [];
    const priority = skillOrder?.priority ?? recommendation.skillPriority!.order;

    return {
      source: skillOrder?.scope ?? 'ai',
      levels: hasStandardSkillRanks(spells) ? completeSkillOrder(observed, priority) : observed,
      observedLevels: observed.length,
      priority,
      spells: spells.map(({ key, name, icon }) => ({ key, name, icon })),
      matches: skillOrder?.matches ?? 0,
      reason: skillOrder ? null : recommendation.skillPriority!.reason,
    };
  }

  private async toResponse(
    recommendation: RawRecommendation,
    { champion, spells, enemies, catalog, treesById, highElo, skillOrder }: ResponseContext,
  ): Promise<BuildRecommendation> {
    const itemsById = new Map(catalog.map((item) => [item.id, item]));
    const enemiesById = new Map(enemies.map((enemy) => [enemy.id, enemy]));
    const buildPath = highElo?.buildPath ?? null;
    const highEloUsage = new Map(highElo?.items.map((usage) => [usage.itemId, usage.matches]));

    const build = recommendation.items.map(({ itemId, reason }, index) => {
      const item = itemsById.get(itemId)!;
      return {
        order: index + 1,
        id: itemId,
        name: item.name,
        icon: item.icon,
        gold: item.gold,
        reason,
        // Fração das partidas de alto elo desse campeão nessa rota que terminaram com o item.
        highEloPickRate: highElo ? (highEloUsage.get(itemId) ?? 0) / highElo.matches : null,
        highEloSecond: buildPath?.itemSeconds[index] ?? null,
        components: groupItems(item.from, itemsById)
          .map((component) => ({ ...component, gold: itemsById.get(component.id)!.gold }))
          .sort((a, b) => a.gold - b.gold),
      };
    });

    // O validador já garantiu que árvores e runas existem e respeitam as linhas.
    const { runes } = recommendation;
    const primary = treesById.get(runes.primaryTreeId)!;
    const secondary = treesById.get(runes.secondaryTreeId)!;
    const byRow = (tree: RuneTree, ids: string[]) =>
      [...ids]
        .sort((a, b) => runeSlotIndex(tree, a) - runeSlotIndex(tree, b))
        .map((id) => toRuneRef(findRune(tree.slots.flat(), id)));

    return {
      champion: toLanedRef(champion),
      enemies: enemies.map(toLanedRef),
      build,
      starterItems: groupItems(recommendation.starter.itemIds, itemsById),
      starterReason: recommendation.starter.reason,
      purchaseOrder: build.map((item) => item.name),
      skillOrder: this.skillOrderResponse(skillOrder, recommendation, spells),
      runes: {
        primary: {
          tree: toTreeRef(primary),
          keystone: toRuneRef(findRune(primary.keystones, runes.keystoneId)),
          runes: byRow(primary, runes.primaryRuneIds),
        },
        secondary: {
          tree: toTreeRef(secondary),
          runes: byRow(secondary, runes.secondaryRuneIds),
        },
        reason: runes.reason,
      },
      totalGold: build.reduce((total, item) => total + item.gold, 0),
      threats: recommendation.threats.map(({ championId, reason }) => ({
        champion: toRef(enemiesById.get(championId)!),
        reason,
      })),
      justification: recommendation.justification,
      balance: recommendation.balance,
      warnings: recommendation.warnings,
      highElo: highElo && {
        tiers: [...HIGH_ELO_TIERS],
        patches: highElo.patches,
        matches: highElo.matches,
        winRate: highElo.wins / highElo.matches,
        timelineMatches: buildPath?.matches ?? 0,
      },
      dataVersion: await this.deps.itemCatalog.getVersion(),
    };
  }
}
