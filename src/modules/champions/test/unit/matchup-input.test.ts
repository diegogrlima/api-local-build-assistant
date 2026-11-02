import { describe, expect, it } from 'vitest';
import { AppError } from '../../../../shared/errors/app-error.js';
import type { ChampionCatalog } from '../../champion-catalog.js';
import type { Champion } from '../../champion.js';
import { validateMatchupInput } from '../../matchup-input.js';

const champions: Champion[] = ['1', '2', '3', '4', '5', '6', '7'].map((id) => ({
  id,
  name: `Campeão ${id}`,
  icon: `${id}.png`,
}));

const catalog: ChampionCatalog = {
  getAll: async () => champions,
  getById: async (id) => champions.find((champion) => champion.id === id),
  getVersion: async () => '1.0.0',
};

const validInput = { championId: '1', enemyChampionIds: ['2', '3', '4', '5', '6'] };

async function errorFrom(input: unknown): Promise<AppError> {
  try {
    await validateMatchupInput(input, catalog);
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Era esperado que a validação falhasse.');
}

describe('validateMatchupInput', () => {
  it('retorna o campeão e os adversários resolvidos quando a entrada é válida', async () => {
    const result = await validateMatchupInput(validInput, catalog);

    expect(result.champion).toEqual(champions[0]);
    expect(result.enemies.map((enemy) => enemy.id)).toEqual(['2', '3', '4', '5', '6']);
  });

  it.each([
    ['corpo ausente', undefined],
    ['sem championId', { enemyChampionIds: ['2', '3', '4', '5', '6'] }],
    ['championId vazio', { ...validInput, championId: '' }],
    ['sem enemyChampionIds', { championId: '1' }],
    ['adversários que não são strings', { championId: '1', enemyChampionIds: [2, 3, 4, 5, 6] }],
  ])('rejeita formato inválido (%s) com INVALID_INPUT', async (_nome, input) => {
    const error = await errorFrom(input);

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.statusCode).toBe(400);
  });

  it.each([
    ['menos de 5', ['2', '3', '4', '5']],
    ['mais de 5', ['2', '3', '4', '5', '6', '7']],
    ['nenhum', []],
  ])('rejeita %s adversários com INVALID_ENEMY_COUNT', async (_nome, enemyChampionIds) => {
    const error = await errorFrom({ championId: '1', enemyChampionIds });

    expect(error.code).toBe('INVALID_ENEMY_COUNT');
  });

  it('rejeita campeão do jogador inexistente com CHAMPION_NOT_FOUND', async () => {
    const error = await errorFrom({ ...validInput, championId: '999' });

    expect(error.code).toBe('CHAMPION_NOT_FOUND');
    expect(error.message).toContain('999');
  });

  it('lista todos os ids inexistentes de uma vez', async () => {
    const error = await errorFrom({
      championId: '1',
      enemyChampionIds: ['2', '888', '4', '5', '999'],
    });

    expect(error.code).toBe('CHAMPION_NOT_FOUND');
    expect(error.message).toContain('888');
    expect(error.message).toContain('999');
  });

  it('rejeita adversários repetidos com ENEMIES_DUPLICATED', async () => {
    const error = await errorFrom({ championId: '1', enemyChampionIds: ['2', '2', '4', '5', '6'] });

    expect(error.code).toBe('ENEMIES_DUPLICATED');
  });

  it('rejeita o campeão do jogador entre os adversários com PLAYER_CHAMPION_IN_ENEMIES', async () => {
    const error = await errorFrom({ championId: '1', enemyChampionIds: ['1', '3', '4', '5', '6'] });

    expect(error.code).toBe('PLAYER_CHAMPION_IN_ENEMIES');
  });
});
