import type { FastifyPluginAsync } from 'fastify';
import { buildRecommendationSchema } from './build-recommendation.js';
import type { RecommendationService } from './recommendation-service.js';

type BuildsRoutesOptions = {
  recommendationService: RecommendationService;
};

export const buildsRoutes: FastifyPluginAsync<BuildsRoutesOptions> = async (
  app,
  { recommendationService },
) => {
  app.post('/builds/recommendations', async (request) => {
    // Se a entrada for inválida, o serviço lança AppError e a análise nunca começa.
    const recommendation = await recommendationService.recommend(request.body);

    return buildRecommendationSchema.parse(recommendation);
  });
};
