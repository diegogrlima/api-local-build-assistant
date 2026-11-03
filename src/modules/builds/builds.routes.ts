import type { FastifyPluginAsync } from 'fastify';
import { buildRecommendationSchema } from './build-recommendation.js';
import type { RecommendationService } from './recommendation-service.js';

type BuildsRoutesOptions = {
  recommendationService: RecommendationService;
  // Limite por IP por minuto: cada chamada consome a cota da chave da Gemini.
  rateLimitMax: number;
};

export const buildsRoutes: FastifyPluginAsync<BuildsRoutesOptions> = async (
  app,
  { recommendationService, rateLimitMax },
) => {
  app.post(
    '/builds/recommendations',
    { config: { rateLimit: { max: rateLimitMax, timeWindow: '1 minute' } } },
    async (request) => {
      // Se a entrada for inválida, o serviço lança AppError e a análise nunca começa.
      const recommendation = await recommendationService.recommend(request.body);

      return buildRecommendationSchema.parse(recommendation);
    },
  );
};
