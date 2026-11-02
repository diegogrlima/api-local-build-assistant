import { z } from 'zod';
import { LANES } from '../champions/lane.js';

const championRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
});

const lanedChampionSchema = championRefSchema.extend({ lane: z.enum(LANES) });

const runeTreeRefSchema = z.object({ id: z.string(), name: z.string(), icon: z.string() });

const runeRefSchema = runeTreeRefSchema.extend({ description: z.string() });

export const buildRecommendationSchema = z.object({
  champion: lanedChampionSchema,
  enemies: z.array(lanedChampionSchema),
  // Itens já na ordem de compra.
  build: z.array(
    z.object({
      order: z.number().int().positive(),
      id: z.string(),
      name: z.string(),
      icon: z.string(),
      gold: z.number(),
      reason: z.string(),
      // Entre 0 e 1; null quando não há dados de alto elo.
      highEloPickRate: z.number().nullable(),
    }),
  ),
  purchaseOrder: z.array(z.string()),
  runes: z.object({
    primary: z.object({
      tree: runeTreeRefSchema,
      keystone: runeRefSchema,
      // Uma runa por linha, na ordem das linhas.
      runes: z.array(runeRefSchema),
    }),
    secondary: z.object({ tree: runeTreeRefSchema, runes: z.array(runeRefSchema) }),
    reason: z.string(),
  }),
  totalGold: z.number(),
  threats: z.array(z.object({ champion: championRefSchema, reason: z.string() })),
  justification: z.string(),
  balance: z.string(),
  warnings: z.array(z.string()),
  // Partidas de Challenger e Grão-Mestre usadas como base; null quando não há dados.
  highElo: z
    .object({
      tiers: z.array(z.string()),
      patches: z.array(z.string()),
      matches: z.number().int(),
      winRate: z.number(),
    })
    .nullable(),
  dataVersion: z.string(),
});

export type BuildRecommendation = z.infer<typeof buildRecommendationSchema>;
