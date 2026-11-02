import { z } from 'zod';
import { LANES } from '../champions/lane.js';

// Página de runas usada na partida (os fragmentos de atributo ficam de fora, como na recomendação).
const runePageSchema = z.object({
  primaryTreeId: z.string(),
  keystoneId: z.string(),
  primaryRuneIds: z.array(z.string()),
  secondaryTreeId: z.string(),
  secondaryRuneIds: z.array(z.string()),
});

const participantSampleSchema = z.object({
  championId: z.string(),
  lane: z.enum(LANES),
  teamId: z.number().int(),
  win: z.boolean(),
  // Itens do inventário ao fim da partida (item0 a item5), sem os espaços vazios.
  items: z.array(z.string()),
  runes: runePageSchema,
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
export type ParticipantSample = z.infer<typeof participantSampleSchema>;
export type MatchSample = z.infer<typeof matchSampleSchema>;
