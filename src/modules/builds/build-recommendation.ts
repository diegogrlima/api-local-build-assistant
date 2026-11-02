import { z } from 'zod';
import { LANES } from '../champions/lane.js';
import { SKILL_KEYS } from '../high-elo/match-sample.js';

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
      // Entre 0 e 1; null quando não há dados de alto elo.
      highEloPickRate: z.number().nullable(),
      // Segundo mediano em que o alto elo completa o item desta posição da build (1º, 2º...);
      // null quando não há linha do tempo das partidas.
      highEloSecond: z.number().int().nullable(),
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
  // Ordem de habilidades: das partidas de alto elo do campeão na rota ("lane") ou em qualquer
  // rota ("champion"); sem partidas, só a prioridade escolhida pela IA ("ai").
  skillOrder: z.object({
    source: z.enum(['lane', 'champion', 'ai']),
    // Habilidade de cada nível, do 1 ao 18. Só termina antes em campeões com regras próprias
    // de pontos (ex.: Udyr), em que apenas os níveis das partidas são mostrados.
    levels: z.array(z.enum(SKILL_KEYS)),
    // Quantos níveis iniciais vêm das partidas; os seguintes são sugeridos pela prioridade.
    observedLevels: z.number().int(),
    // Ordem para maximizar as habilidades básicas (ex.: Q > E > W).
    priority: z.array(z.enum(SKILL_KEYS)),
    spells: z.array(z.object({ key: z.enum(SKILL_KEYS), name: z.string(), icon: z.string() })),
    matches: z.number().int(),
    // Justificativa da IA; null quando a ordem vem das partidas.
    reason: z.string().nullable(),
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
  // Partidas de Challenger e Grão-Mestre usadas como base; null quando não há dados.
  highElo: z
    .object({
      tiers: z.array(z.string()),
      patches: z.array(z.string()),
      matches: z.number().int(),
      winRate: z.number(),
      // Quantas dessas partidas têm a linha do tempo usada no caminho da build.
      timelineMatches: z.number().int(),
    })
    .nullable(),
  dataVersion: z.string(),
});

export type BuildRecommendation = z.infer<typeof buildRecommendationSchema>;
