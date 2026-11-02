import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ChampionCatalog } from './champion-catalog.js';

type ChampionsRoutesOptions = {
  catalog: ChampionCatalog;
};

const championsResponseSchema = z.object({
  version: z.string(),
  champions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string(),
    }),
  ),
});

// O catálogo só muda a cada patch do jogo, então o cliente pode cachear por um tempo.
const CACHE_CONTROL = 'public, max-age=3600';

export const championsRoutes: FastifyPluginAsync<ChampionsRoutesOptions> = async (
  app,
  { catalog },
) => {
  app.get('/champions', async (_request, reply) => {
    const [version, champions] = await Promise.all([catalog.getVersion(), catalog.getAll()]);

    const sorted = [...champions].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    reply.header('Cache-Control', CACHE_CONTROL);
    return championsResponseSchema.parse({ version, champions: sorted });
  });
};
