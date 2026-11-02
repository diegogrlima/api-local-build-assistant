import { z } from 'zod';
import type { Lane } from '../champions/lane.js';
import type { MatchSample, ParticipantSample } from './match-sample.js';

export const RANKED_SOLO_QUEUE_ID = 420;
// Partidas mais curtas que isso (remakes, rendições precoces) não têm build representativa.
const MIN_GAME_DURATION_S = 15 * 60;

const LANE_BY_POSITION: Record<string, Lane> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'bot',
  UTILITY: 'support',
};

const styleSchema = z.object({
  description: z.string(),
  style: z.number(),
  selections: z.array(z.object({ perk: z.number() })),
});

const participantSchema = z.object({
  championId: z.number(),
  teamPosition: z.string(),
  teamId: z.number(),
  win: z.boolean(),
  gameEndedInEarlySurrender: z.boolean().optional(),
  item0: z.number(),
  item1: z.number(),
  item2: z.number(),
  item3: z.number(),
  item4: z.number(),
  item5: z.number(),
  perks: z.object({ styles: z.array(styleSchema) }),
});

const matchSchema = z.object({
  metadata: z.object({ matchId: z.string() }),
  info: z.object({
    gameVersion: z.string(),
    gameCreation: z.number(),
    gameDuration: z.number(),
    queueId: z.number(),
    participants: z.array(participantSchema),
  }),
});

type RawParticipant = z.infer<typeof participantSchema>;

function toParticipant(raw: RawParticipant): ParticipantSample | null {
  const lane = LANE_BY_POSITION[raw.teamPosition];
  const primary = raw.perks.styles.find((style) => style.description === 'primaryStyle');
  const secondary = raw.perks.styles.find((style) => style.description === 'subStyle');
  if (!lane || !primary || !secondary || primary.selections.length < 4) return null;

  const [keystone, ...primaryRunes] = primary.selections.map((s) => String(s.perk));
  const items = [raw.item0, raw.item1, raw.item2, raw.item3, raw.item4, raw.item5]
    .filter((id) => id > 0)
    .map(String);

  return {
    championId: String(raw.championId),
    lane,
    teamId: raw.teamId,
    win: raw.win,
    items,
    runes: {
      primaryTreeId: String(primary.style),
      keystoneId: keystone!,
      primaryRuneIds: primaryRunes,
      secondaryTreeId: String(secondary.style),
      secondaryRuneIds: secondary.selections.map((s) => String(s.perk)),
    },
  };
}

// Converte a resposta da Match-V5. Devolve null para partidas que não servem de referência:
// outra fila, partida curta ou alguém sem rota definida.
export function parseMatch(raw: unknown): MatchSample | null {
  const parsed = matchSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { metadata, info } = parsed.data;
  if (info.queueId !== RANKED_SOLO_QUEUE_ID) return null;
  if (info.gameDuration < MIN_GAME_DURATION_S) return null;
  if (info.participants.some((p) => p.gameEndedInEarlySurrender)) return null;

  const participants = info.participants.map(toParticipant);
  if (participants.length !== 10 || participants.some((p) => p === null)) return null;

  return {
    matchId: metadata.matchId,
    patch: info.gameVersion.split('.').slice(0, 2).join('.'),
    playedAt: info.gameCreation,
    participants: participants as ParticipantSample[],
  };
}
