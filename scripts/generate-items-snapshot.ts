import { writeFile } from 'node:fs/promises';
import { RiotItemProvider } from '../src/modules/items/riot-item-provider.js';

const OUTPUT = new URL('../src/modules/items/items.snapshot.json', import.meta.url);

const { version, items } = await new RiotItemProvider().fetchCatalog();

await writeFile(OUTPUT, `${JSON.stringify({ version, items }, null, 2)}\n`);

console.log(`Snapshot gerado: versão ${version}, ${items.length} itens.`);
