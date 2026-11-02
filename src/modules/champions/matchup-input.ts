import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import type { ChampionCatalog } from './champion-catalog.js';
import type { Champion } from './champion.js';

export const ENEMY_COUNT = 5;

// Só valida o formato. As regras que dependem do catálogo ficam em validateMatchupInput.
export const matchupInputSchema = z.object({
  championId: z.string().min(1),
  enemyChampionIds: z.array(z.string().min(1)),
});

export type MatchupInput = z.infer<typeof matchupInputSchema>;

export type ValidMatchup = {
  champion: Champion;
  enemies: Champion[];
};

export async function validateMatchupInput(
  input: unknown,
  catalog: ChampionCatalog,
): Promise<ValidMatchup> {
  const parsed = matchupInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      'Informe o campeão do jogador (championId) e a lista de adversários (enemyChampionIds).',
      400,
      'INVALID_INPUT',
    );
  }

  const { championId, enemyChampionIds } = parsed.data;

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

  const [champion, ...enemies] = found as Champion[];
  return { champion: champion!, enemies };
}
