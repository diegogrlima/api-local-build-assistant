import { writeFile } from 'node:fs/promises';
import { RiotRuneProvider } from '../src/modules/runes/riot-rune-provider.js';

const OUTPUT = new URL('../src/modules/runes/runes.snapshot.json', import.meta.url);

const { version, entries: trees } = await new RiotRuneProvider().fetchData();

await writeFile(OUTPUT, `${JSON.stringify({ version, trees }, null, 2)}\n`);

console.log(`Snapshot gerado: versão ${version}, ${trees.length} árvores de runas.`);
