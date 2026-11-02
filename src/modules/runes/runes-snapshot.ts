import { z } from 'zod';
import type { VersionedData } from '../../shared/catalog/in-memory-catalog.js';
import type { RuneTree } from './rune.js';
import rawSnapshot from './runes.snapshot.json' with { type: 'json' };

const runeSchema = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  description: z.string(),
  icon: z.string().min(1),
});

const snapshotSchema = z.object({
  version: z.string().min(1),
  trees: z.array(
    z.object({
      id: z.string().regex(/^\d+$/),
      name: z.string().min(1),
      icon: z.string().min(1),
      keystones: z.array(runeSchema).min(1),
      slots: z.array(z.array(runeSchema).min(1)).min(1),
    }),
  ),
});

// O JSON é importado (e não lido via fs) para que o tsc o copie para dist/.
export function loadRunesSnapshot(): VersionedData<RuneTree> {
  const { version, trees } = snapshotSchema.parse(rawSnapshot);
  return { version, entries: trees };
}
