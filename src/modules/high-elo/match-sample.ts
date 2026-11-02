import { z } from 'zod';
import { LANES } from '../champions/lane.js';

export const SKILL_KEYS = ['Q', 'W', 'E', 'R'] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

// Página de runas usada na partida (os fragmentos de atributo ficam de fora, como na recomendação).
const runePageSchema = z.object({
  primaryTreeId: z.string(),
  keystoneId: z.string(),
  primaryRuneIds: z.array(z.string()),
  secondaryTreeId: z.string(),
  secondaryRuneIds: z.array(z.string()),
});

// Momentos de compra tirados da linha do tempo da partida (Match-V5 timeline).
const purchaseTimelineSchema = z.object({
  // Itens comprados antes de sair da base no início da partida, com repetição (ex.: 2 poções).
  starterItems: z.array(z.string()),
  // Segundo da partida em que cada item de `items` foi comprado (mesma ordem); null quando o
  // item não veio de uma compra (ex.: transformação).
  itemSeconds: z.array(z.number().nullable()),
  // Habilidade que recebeu cada ponto, na ordem dos níveis (ex.: ["Q", "E", "W", "Q", ...]).
  // Ausente nas linhas do tempo guardadas antes de a ordem das habilidades ser coletada.
  skillOrder: z.array(z.enum(SKILL_KEYS)).optional(),
});

const participantSampleSchema = z.object({
  championId: z.string(),
  lane: z.enum(LANES),
  teamId: z.number().int(),
  win: z.boolean(),
  // Itens do inventário ao fim da partida (item0 a item5), sem os espaços vazios.
  items: z.array(z.string()),
  runes: runePageSchema,
  // Ausente nas partidas coletadas antes da linha do tempo ou quando ela não pôde ser obtida.
  timeline: purchaseTimelineSchema.optional(),
});

// Resumo de uma partida ranqueada solo/duo de Challenger ou Grão-Mestre.
export const matchSampleSchema = z.object({
  matchId: z.string(),
  // Patch no formato "16.21" (os dois primeiros números de gameVersion).
  patch: z.string(),
  playedAt: z.number(),
  participants: z.array(participantSampleSchema),
});

export type RunePage = z.infer<typeof runePageSchema>;
export type PurchaseTimeline = z.infer<typeof purchaseTimelineSchema>;
export type ParticipantSample = z.infer<typeof participantSampleSchema>;
export type MatchSample = z.infer<typeof matchSampleSchema>;
