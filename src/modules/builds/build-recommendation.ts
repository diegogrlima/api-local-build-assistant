import { z } from 'zod';

const championRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
});

export const buildRecommendationSchema = z.object({
  champion: championRefSchema,
  enemies: z.array(championRefSchema),
  // Itens já na ordem de compra.
  build: z.array(
    z.object({
      order: z.number().int().positive(),
      id: z.string(),
      name: z.string(),
      icon: z.string(),
      gold: z.number(),
      reason: z.string(),
    }),
  ),
  purchaseOrder: z.array(z.string()),
  totalGold: z.number(),
  threats: z.array(z.object({ champion: championRefSchema, reason: z.string() })),
  justification: z.string(),
  balance: z.string(),
  warnings: z.array(z.string()),
  dataVersion: z.string(),
});

export type BuildRecommendation = z.infer<typeof buildRecommendationSchema>;
