import { writeFile } from 'node:fs/promises';
import { RiotChampionDetailsProvider } from '../src/modules/champions/riot-champion-details-provider.js';

const OUTPUT = new URL('../src/modules/champions/champion-details.snapshot.json', import.meta.url);

const { version, entries } = await new RiotChampionDetailsProvider().fetchData();

await writeFile(OUTPUT, `${JSON.stringify({ version, champions: entries }, null, 2)}\n`);

console.log(`Snapshot gerado: versão ${version}, detalhes de ${entries.length} campeões.`);
