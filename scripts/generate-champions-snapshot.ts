import { writeFile } from 'node:fs/promises';
import { RiotChampCatalog } from '../src/modules/champions/riot-champion-catalog.js';

const OUTPUT = new URL('../src/modules/champions/champions.snapshot.json', import.meta.url);

const catalog = new RiotChampCatalog();
const [version, champions] = await Promise.all([catalog.getVersion(), catalog.getAll()]);

await writeFile(OUTPUT, `${JSON.stringify({ version, champions }, null, 2)}\n`);

console.log(`Snapshot gerado: versão ${version}, ${champions.length} campeões.`);
