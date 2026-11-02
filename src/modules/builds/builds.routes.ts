import type { FastifyPluginAsync } from 'fastify';
import type { ChampionCatalog } from '../champions/champion-catalog.js';
import { validateMatchupInput } from '../champions/matchup-input.js';
import { AppError } from '../../shared/errors/app-error.js';

type BuildsRoutesOptions = {
  catalog: ChampionCatalog;
};

export const buildsRoutes: FastifyPluginAsync<BuildsRoutesOptions> = async (app, { catalog }) => {
  app.post('/builds/recommendations', async (request) => {
    // Se a entrada for inválida, validateMatchupInput lança AppError e a análise nunca começa.
    await validateMatchupInput(request.body, catalog);

    // A recomendação em si ainda não existe; ela entra no ticket da build.
    throw new AppError(
      'A recomendação de build ainda não foi implementada.',
      501,
      'RECOMMENDATION_NOT_IMPLEMENTED',
    );
  });
};
