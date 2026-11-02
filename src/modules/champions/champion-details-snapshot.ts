import { z } from 'zod';
import type { VersionedData } from '../../shared/catalog/in-memory-catalog.js';
import type { ChampionDetails } from './champion-details.js';
import rawSnapshot from './champion-details.snapshot.json' with { type: 'json' };

const textList = z.array(z.string());

const snapshotSchema = z.object({
  version: z.string().min(1),
  champions: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      name: z.string().min(1),
      title: z.string(),
      tags: textList,
      info: z.object({
        attack: z.number(),
        defense: z.number(),
        magic: z.number(),
        difficulty: z.number(),
      }),
      resource: z.string(),
      passive: z.object({ name: z.string(), description: z.string() }),
      spells: z.array(
        z.object({
          key: z.enum(['Q', 'W', 'E', 'R']),
          name: z.string(),
          description: z.string(),
        }),
      ),
      allyTips: textList,
      enemyTips: textList,
      signals: z.object({
        physicalDamage: z.number(),
        magicDamage: z.number(),
        trueDamage: z.number(),
        healing: z.number(),
        shield: z.number(),
        crowdControl: z.number(),
        stealth: z.number(),
      }),
    }),
  ),
});

// O JSON é importado (e não lido via fs) para que o tsc o copie para dist/.
export function loadChampionDetailsSnapshot(): VersionedData<ChampionDetails> {
  const { version, champions } = snapshotSchema.parse(rawSnapshot);
  return { version, entries: champions };
}
