import { z } from 'zod';
import { LANES } from '../champions/lane.js';
import { SKILL_KEYS } from './skill-keys.js';

const championRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
});

const lanedChampionSchema = championRefSchema.extend({ lane: z.enum(LANES) });

const itemRefSchema = z.object({ id: z.string(), name: z.string(), icon: z.string() });

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
      // Componentes da receita (Data Dragon) a comprar antes de fechar o item, do mais barato
      // ao mais caro; vazio para itens sem receita.
      components: z.array(
        itemRefSchema.extend({ gold: z.number(), count: z.number().int().positive() }),
      ),
    }),
  ),
  // Compra inicial recomendada (Doran, poções, companheiro da selva...), com a quantidade.
  starterItems: z.array(itemRefSchema.extend({ count: z.number().int().positive() })),
  starterReason: z.string(),
  purchaseOrder: z.array(z.string()),
  // Ordem de habilidades montada a partir da prioridade escolhida pela IA.
  skillOrder: z.object({
    // Habilidade de cada nível, do 1 ao 18. Fica vazia em campeões com regras próprias de
    // pontos (ex.: Udyr), em que só a prioridade é mostrada.
    levels: z.array(z.enum(SKILL_KEYS)),
    // Ordem para maximizar as habilidades básicas (ex.: Q > E > W).
    priority: z.array(z.enum(SKILL_KEYS)),
    spells: z.array(z.object({ key: z.enum(SKILL_KEYS), name: z.string(), icon: z.string() })),
    reason: z.string(),
  }),
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
  dataVersion: z.string(),
});

export type BuildRecommendation = z.infer<typeof buildRecommendationSchema>;
