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

const LANE_ORDER = ['top', 'jungle', 'mid', 'bot', 'support'];

function enemiesOf(ids: string[], lanes = LANE_ORDER) {
  return ids.map((championId, index) => ({ championId, lane: lanes[index % lanes.length] }));
}

const validInput = { championId: '1', lane: 'mid', enemies: enemiesOf(['2', '3', '4', '5', '6']) };

async function errorFrom(input: unknown): Promise<AppError> {
  try {
    await validateMatchupInput(input, catalog);
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Era esperado que a validação falhasse.');
}

describe('validateMatchupInput', () => {
  it('retorna o campeão e os adversários resolvidos, com as rotas, quando a entrada é válida', async () => {
    const result = await validateMatchupInput(validInput, catalog);

    expect(result.champion).toEqual({ ...champions[0], lane: 'mid' });
    expect(result.enemies.map((enemy) => [enemy.id, enemy.lane])).toEqual([
      ['2', 'top'],
      ['3', 'jungle'],
      ['4', 'mid'],
      ['5', 'bot'],
      ['6', 'support'],
    ]);
  });

  it.each([
    ['corpo ausente', undefined],
    ['sem championId', { ...validInput, championId: undefined }],
    ['championId vazio', { ...validInput, championId: '' }],
    ['sem rota do jogador', { ...validInput, lane: undefined }],
    ['rota do jogador inexistente', { ...validInput, lane: 'base' }],
    ['sem adversários', { championId: '1', lane: 'mid' }],
    ['adversário sem rota', { ...validInput, enemies: [{ championId: '2' }] }],
    [
      'adversários que não são strings',
      { ...validInput, enemies: [2, 3, 4, 5, 6].map((id) => ({ championId: id, lane: 'top' })) },
    ],
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
  ])('rejeita %s adversários com INVALID_ENEMY_COUNT', async (_nome, ids) => {
    const error = await errorFrom({ ...validInput, enemies: enemiesOf(ids) });

    expect(error.code).toBe('INVALID_ENEMY_COUNT');
  });

  it('rejeita campeão do jogador inexistente com CHAMPION_NOT_FOUND', async () => {
    const error = await errorFrom({ ...validInput, championId: '999' });

    expect(error.code).toBe('CHAMPION_NOT_FOUND');
    expect(error.message).toContain('999');
  });

  it('lista todos os ids inexistentes de uma vez', async () => {
    const error = await errorFrom({
      ...validInput,
      enemies: enemiesOf(['2', '888', '4', '5', '999']),
    });

    expect(error.code).toBe('CHAMPION_NOT_FOUND');
    expect(error.message).toContain('888');
    expect(error.message).toContain('999');
  });

  it('rejeita adversários repetidos com ENEMIES_DUPLICATED', async () => {
    const error = await errorFrom({ ...validInput, enemies: enemiesOf(['2', '2', '4', '5', '6']) });

    expect(error.code).toBe('ENEMIES_DUPLICATED');
  });

  it('rejeita o campeão do jogador entre os adversários com PLAYER_CHAMPION_IN_ENEMIES', async () => {
    const error = await errorFrom({ ...validInput, enemies: enemiesOf(['1', '3', '4', '5', '6']) });

    expect(error.code).toBe('PLAYER_CHAMPION_IN_ENEMIES');
  });

  it('rejeita adversários na mesma rota com ENEMY_LANES_DUPLICATED', async () => {
    const lanes = ['top', 'top', 'mid', 'bot', 'support'];
    const error = await errorFrom({
      ...validInput,
      enemies: enemiesOf(['2', '3', '4', '5', '6'], lanes),
    });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('ENEMY_LANES_DUPLICATED');
  });

  it('aceita o jogador na mesma rota de um adversário (o oponente direto)', async () => {
    const result = await validateMatchupInput({ ...validInput, lane: 'top' }, catalog);

    expect(result.champion.lane).toBe('top');
  });
});
