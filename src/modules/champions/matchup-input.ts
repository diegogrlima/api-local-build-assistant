import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import type { ChampionCatalog } from './champion-catalog.js';
import type { Champion } from './champion.js';
import { LANES, type Lane } from './lane.js';

export const ENEMY_COUNT = 5;

// Só valida o formato. As regras que dependem do catálogo ficam em validateMatchupInput.
export const matchupInputSchema = z.object({
  championId: z.string().min(1),
  lane: z.enum(LANES),
  enemies: z.array(z.object({ championId: z.string().min(1), lane: z.enum(LANES) })),
});

export type MatchupInput = z.infer<typeof matchupInputSchema>;

export type LanedChampion = Champion & { lane: Lane };

export type ValidMatchup = {
  champion: LanedChampion;
  enemies: LanedChampion[];
};

export async function validateMatchupInput(
  input: unknown,
  catalog: ChampionCatalog,
): Promise<ValidMatchup> {
  const parsed = matchupInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      `Informe o campeão do jogador (championId), a rota dele (lane) e os adversários com as rotas (enemies). Rotas válidas: ${LANES.join(', ')}.`,
      400,
      'INVALID_INPUT',
    );
  }

  const { championId, lane, enemies } = parsed.data;
  const enemyChampionIds = enemies.map((enemy) => enemy.championId);

  if (enemyChampionIds.length !== ENEMY_COUNT) {
    throw new AppError(
      `Informe exatamente ${ENEMY_COUNT} campeões adversários (recebidos: ${enemyChampionIds.length}).`,
      400,
      'INVALID_ENEMY_COUNT',
    );
  }

  const requestedIds = [championId, ...enemyChampionIds];
  const found = await Promise.all(requestedIds.map((id) => catalog.getById(id)));

  const unknownIds = requestedIds.filter((_, index) => !found[index]);
  if (unknownIds.length > 0) {
    throw new AppError(
      `Campeões não encontrados: ${unknownIds.join(', ')}.`,
      400,
      'CHAMPION_NOT_FOUND',
    );
  }

  if (new Set(enemyChampionIds).size !== enemyChampionIds.length) {
    throw new AppError('Os campeões adversários não podem se repetir.', 400, 'ENEMIES_DUPLICATED');
  }

  if (enemyChampionIds.includes(championId)) {
    throw new AppError(
      'O campeão do jogador não pode estar entre os adversários.',
      400,
      'PLAYER_CHAMPION_IN_ENEMIES',
    );
  }

  const enemyLanes = enemies.map((enemy) => enemy.lane);
  if (new Set(enemyLanes).size !== enemyLanes.length) {
    throw new AppError(
      'Cada adversário deve estar em uma rota diferente.',
      400,
      'ENEMY_LANES_DUPLICATED',
    );
  }

  const [champion, ...enemyChampions] = found as Champion[];
  return {
    champion: { ...champion!, lane },
    enemies: enemyChampions.map((enemy, index) => ({ ...enemy, lane: enemyLanes[index]! })),
  };
}
