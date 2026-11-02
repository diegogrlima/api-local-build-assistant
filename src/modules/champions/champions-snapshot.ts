import { z } from 'zod';
import type { Champion } from './champion.js';
import rawSnapshot from './champions.snapshot.json' with { type: 'json' };

const snapshotSchema = z.object({
  version: z.string().min(1),
  champions: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      name: z.string().min(1),
      icon: z.string().min(1),
    }),
  ),
});

export type ChampionsSnapshot = {
  version: string;
  champions: Champion[];
};

// O JSON é importado (e não lido via fs) para que o tsc o copie para dist/.
export function loadChampionsSnapshot(): ChampionsSnapshot {
  return snapshotSchema.parse(rawSnapshot);
}
