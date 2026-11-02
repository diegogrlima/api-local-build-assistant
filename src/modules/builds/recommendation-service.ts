import { AppError } from '../../shared/errors/app-error.js';
import type { Champion } from '../champions/champion.js';
import type { ChampionCatalog } from '../champions/champion-catalog.js';
import type { ChampionDetails } from '../champions/champion-details.js';
import { validateMatchupInput } from '../champions/matchup-input.js';
import type { Item } from '../items/item.js';
import type { ItemCatalog } from '../items/item-catalog.js';
import type { BuildAdvisor } from './build-advisor.js';
import type { BuildRecommendation } from './build-recommendation.js';
import { buildPrompt, buildResponseSchema, SYSTEM_INSTRUCTION } from './recommendation-prompt.js';
import { validateRecommendation, type RawRecommendation } from './recommendation-validator.js';

// Uma tentativa extra quando a IA devolve algo que não passa na validação.
const MAX_ATTEMPTS = 2;

export type ChampionDetailsLookup = {
  getById(id: string): ChampionDetails | undefined;
};

type Dependencies = {
  championCatalog: ChampionCatalog;
  championDetails: ChampionDetailsLookup;
  itemCatalog: ItemCatalog;
  // null quando a IA não está configurada (sem GEMINI_API_KEY).
  advisor: BuildAdvisor | null;
};

function toRef({ id, name, icon }: Champion) {
  return { id, name, icon };
}

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
    const [championDetails, ...enemyDetails] = details as ChampionDetails[];

    const items = await this.deps.itemCatalog.getAll();
    if (items.length === 0) {
      throw new AppError(
        'Não há informações sobre itens para recomendar uma build.',
        503,
        'ITEM_DATA_UNAVAILABLE',
      );
    }
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const enemyIds = enemies.map((enemy) => enemy.id);

    const prompt = buildPrompt({ champion: championDetails!, enemies: enemyDetails, items });
    const responseSchema = buildResponseSchema(
      items.map((item) => item.id),
      enemyIds,
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
        enemyIds: new Set(enemyIds),
      });
      if (result.ok) {
        return this.toResponse(result.value, champion, enemies, itemsById);
      }

      feedback = `\n\nSua resposta anterior foi rejeitada pelos motivos abaixo. Corrija e responda novamente.\n- ${result.problems.join('\n- ')}`;
    }

    throw new AppError(
      'A IA não gerou uma recomendação válida. Tente novamente.',
      502,
      'RECOMMENDATION_INVALID',
    );
  }

  private async toResponse(
    recommendation: RawRecommendation,
    champion: Champion,
    enemies: Champion[],
    itemsById: ReadonlyMap<string, Item>,
  ): Promise<BuildRecommendation> {
    const enemiesById = new Map(enemies.map((enemy) => [enemy.id, enemy]));

    const build = recommendation.items.map(({ itemId, reason }, index) => {
      const item = itemsById.get(itemId)!;
      return {
        order: index + 1,
        id: itemId,
        name: item.name,
        icon: item.icon,
        gold: item.gold,
        reason,
      };
    });

    return {
      champion: toRef(champion),
      enemies: enemies.map(toRef),
      build,
      purchaseOrder: build.map((item) => item.name),
      totalGold: build.reduce((total, item) => total + item.gold, 0),
      threats: recommendation.threats.map(({ championId, reason }) => ({
        champion: toRef(enemiesById.get(championId)!),
        reason,
      })),
      justification: recommendation.justification,
      balance: recommendation.balance,
      warnings: recommendation.warnings,
      dataVersion: await this.deps.itemCatalog.getVersion(),
    };
  }
}
