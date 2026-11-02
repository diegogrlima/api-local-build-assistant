import { z } from 'zod';
import { SKILL_KEYS, type MatchSample, type SkillKey } from './match-sample.js';

// Compras feitas até aqui contam como itens iniciais (antes de sair da base).
export const STARTER_WINDOW_S = 90;

const eventSchema = z.object({
  type: z.string(),
  timestamp: z.number(),
  participantId: z.number().optional(),
  itemId: z.number().optional(),
  beforeId: z.number().optional(),
  skillSlot: z.number().optional(),
  levelUpType: z.string().optional(),
});

const timelineSchema = z.object({
  info: z.object({
    frames: z.array(z.object({ events: z.array(eventSchema) })),
  }),
});

type Purchase = { itemId: string; second: number };

// Compras de cada participante (participantId de 1 a 10), já sem as que foram desfeitas.
function purchasesByParticipant(events: z.infer<typeof eventSchema>[]) {
  const purchases = new Map<number, Purchase[]>();
  for (const event of events) {
    if (event.participantId === undefined) continue;
    const list = purchases.get(event.participantId) ?? [];
    purchases.set(event.participantId, list);

    if (event.type === 'ITEM_PURCHASED' && event.itemId) {
      list.push({ itemId: String(event.itemId), second: Math.round(event.timestamp / 1000) });
    } else if (event.type === 'ITEM_UNDO' && event.beforeId) {
      // Desfazer uma compra traz o item desfeito em beforeId.
      const undone = list.findLastIndex((p) => p.itemId === String(event.beforeId));
      if (undone >= 0) list.splice(undone, 1);
    }
  }
  return purchases;
}

// Pontos de habilidade de cada participante, na ordem. As evoluções (ex.: Kha'Zix) não contam.
function skillsByParticipant(events: z.infer<typeof eventSchema>[]) {
  const skills = new Map<number, SkillKey[]>();
  for (const event of events) {
    if (event.type !== 'SKILL_LEVEL_UP' || event.levelUpType !== 'NORMAL') continue;
    const key = SKILL_KEYS[(event.skillSlot ?? 0) - 1];
    if (event.participantId === undefined || !key) continue;
    skills.set(event.participantId, [...(skills.get(event.participantId) ?? []), key]);
  }
  return skills;
}

// Acrescenta à partida os momentos de compra e a ordem das habilidades da resposta crua da timeline da Match-V5.
// Devolve a partida sem alterações quando a timeline não tem o formato esperado.
export function addPurchaseTimeline(sample: MatchSample, raw: unknown): MatchSample {
  const parsed = timelineSchema.safeParse(raw);
  if (!parsed.success) return sample;

  const events = parsed.data.info.frames.flatMap((f) => f.events);
  const purchases = purchasesByParticipant(events);
  const skills = skillsByParticipant(events);

  return {
    ...sample,
    // Na Match-V5, os participantes vêm na ordem dos participantId (1 a 10).
    participants: sample.participants.map((participant, index) => {
      const list = purchases.get(index + 1) ?? [];
      return {
        ...participant,
        timeline: {
          starterItems: list.filter((p) => p.second <= STARTER_WINDOW_S).map((p) => p.itemId),
          // O item que ficou no inventário é o da última compra dele.
          itemSeconds: participant.items.map(
            (itemId) => list.findLast((p) => p.itemId === itemId)?.second ?? null,
          ),
          skillOrder: skills.get(index + 1) ?? [],
        },
      };
    }),
  };
}
