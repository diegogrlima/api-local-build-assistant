import { z } from 'zod';
import type { ItemCatalogData } from './item-provider.js';
import rawSnapshot from './items.snapshot.json' with { type: 'json' };

const snapshotSchema = z.object({
  version: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      name: z.string().min(1),
      plaintext: z.string(),
      description: z.string(),
      gold: z.number(),
      tags: z.array(z.string()),
      isBoots: z.boolean(),
      isBuildItem: z.boolean(),
      from: z.array(z.string()),
      icon: z.string().min(1),
    }),
  ),
});

// O JSON é importado (e não lido via fs) para que o tsc o copie para dist/.
export function loadItemsSnapshot(): ItemCatalogData {
  return snapshotSchema.parse(rawSnapshot);
}
