import type { Lane } from '../champions/lane.js';
import type { MatchSample, ParticipantSample, RunePage, SkillKey } from './match-sample.js';

// Quantos itens e páginas de runas mais frequentes entram no resumo.
const TOP_ITEMS = 12;
const TOP_ITEMS_VERSUS_ENEMY = 6;
const TOP_KEYSTONES = 4;
const TOP_RUNE_PAGES = 3;
// Posições do caminho da build (uma build completa tem 6 itens).
const BUILD_PATH_STEPS = 6;
const MAX_LEVEL = 18;
// A sequência de habilidades para quando menos partidas que isso seguiram o mesmo caminho.
const MIN_SKILL_ORDER_MATCHES = 3;
const BASIC_SKILLS: SkillKey[] = ['Q', 'W', 'E'];

export type Usage = { matches: number; wins: number };

export type ItemUsage = Usage & { itemId: string };

export type HighEloSummary = Usage & {
  patches: string[];
  items: ItemUsage[];
  keystones: (Usage & { keystoneId: string; primaryTreeId: string })[];
  runePages: (Usage & { page: RunePage })[];
  // Caminho da build, das partidas que têm a linha do tempo; null quando nenhuma tem.
  buildPath: {
    matches: number;
    // Compra inicial mais comum, com repetição (ex.: Lâmina de Doran e duas poções).
    starterItems: string[];
    // Partidas que começaram com exatamente essa compra.
    starterMatches: number;
    // Segundo mediano em que o 1º, 2º... 6º item completo ficou pronto; null sem amostra.
    itemSeconds: (number | null)[];
  } | null;
  // Como os jogadores de alto elo jogaram esse campeão nessa rota contra cada adversário.
  versusEnemies: (Usage & {
    championId: string;
    laneOpponent: boolean;
    items: ItemUsage[];
  })[];
};

export type HighEloQuery = {
  championId: string;
  lane: Lane;
  enemies: { championId: string; lane: Lane }[];
  // Só entram itens que podem ser recomendados (itens completos e botas do catálogo).
  allowedItemIds: ReadonlySet<string>;
  // Itens que podem compor a compra inicial (Doran, poções...).
  starterItemIds: ReadonlySet<string>;
};

type Game = { patch: string; player: ParticipantSample; enemies: ParticipantSample[] };

function count<T>(games: Game[], keysOf: (game: Game) => T[], keyOf: (value: T) => string) {
  const usage = new Map<string, Usage & { value: T }>();
  for (const game of games) {
    // Cada chave conta uma vez por partida, mesmo que se repita no inventário.
    const seen = new Set<string>();
    for (const value of keysOf(game)) {
      const key = keyOf(value);
      if (seen.has(key)) continue;
      seen.add(key);

      const entry = usage.get(key) ?? { value, matches: 0, wins: 0 };
      entry.matches++;
      if (game.player.win) entry.wins++;
      usage.set(key, entry);
    }
  }
  return [...usage.values()].sort((a, b) => b.matches - a.matches || b.wins - a.wins);
}

function wins(games: Game[]): number {
  return games.filter((game) => game.player.win).length;
}

function itemUsage(games: Game[], allowed: ReadonlySet<string>, limit: number): ItemUsage[] {
  return count(
    games,
    (game) => game.player.items.filter((id) => allowed.has(id)),
    (id) => id,
  )
    .slice(0, limit)
    .map(({ value, matches, wins }) => ({ itemId: value, matches, wins }));
}

function pageKey(page: RunePage): string {
  return [
    page.primaryTreeId,
    page.keystoneId,
    ...page.primaryRuneIds,
    page.secondaryTreeId,
    ...[...page.secondaryRuneIds].sort(),
  ].join(':');
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function buildPath(
  games: Game[],
  allowed: ReadonlySet<string>,
  starters: ReadonlySet<string>,
): HighEloSummary['buildPath'] {
  const withTimeline = games.filter((game) => game.player.timeline);
  if (withTimeline.length === 0) return null;

  const starterCombos = count(
    withTimeline,
    ({ player }) => [player.timeline!.starterItems.filter((id) => starters.has(id))],
    (combo) => [...combo].sort().join(':'),
  );

  // Em cada partida, o segundo em que cada item completo do inventário final ficou pronto.
  const completions = withTimeline.map(({ player }) =>
    player
      .timeline!.itemSeconds.filter(
        (second, index): second is number => second !== null && allowed.has(player.items[index]!),
      )
      .sort((a, b) => a - b),
  );

  return {
    matches: withTimeline.length,
    starterItems: starterCombos[0]?.value ?? [],
    starterMatches: starterCombos[0]?.matches ?? 0,
    itemSeconds: Array.from({ length: BUILD_PATH_STEPS }, (_, step) =>
      median(completions.flatMap((seconds) => (step < seconds.length ? [seconds[step]!] : []))),
    ),
  };
}

export type SkillOrderSummary = {
  // "lane": partidas do campeão na rota; "champion": em qualquer rota, quando a rota não tem dados.
  scope: 'lane' | 'champion';
  matches: number;
  // Habilidade de cada nível, do 1 em diante; termina antes do 18 quando poucas partidas
  // seguiram a mesma sequência até ali.
  levels: SkillKey[];
  // Ordem para maximizar as habilidades básicas (ex.: ["Q", "E", "W"]).
  priority: SkillKey[];
};

// Sequência mais comum, montada nível a nível: em cada nível, a habilidade mais escolhida entre
// as partidas que seguiram a mesma sequência até ali. Assim ela é sempre uma sequência real.
function mostCommonSkillOrder(orders: SkillKey[][]) {
  let following = orders;
  const levels: SkillKey[] = [];
  while (levels.length < MAX_LEVEL) {
    const level = levels.length;
    const votes = new Map<SkillKey, number>();
    for (const order of following) {
      const key = order[level];
      if (key) votes.set(key, (votes.get(key) ?? 0) + 1);
    }
    const [best] = [...votes].sort((a, b) => b[1] - a[1]);
    if (!best || best[1] < MIN_SKILL_ORDER_MATCHES) break;

    levels.push(best[0]);
    following = following.filter((order) => order[level] === best[0]);
  }

  // Maximiza primeiro quem tem mais pontos; no empate, quem chegou antes a esse total.
  const points = (key: SkillKey) => levels.filter((k) => k === key).length;
  const reachedAt = (key: SkillKey) => levels.lastIndexOf(key);
  const priority = [...BASIC_SKILLS].sort(
    (a, b) => points(b) - points(a) || reachedAt(a) - reachedAt(b),
  );

  return { levels, priority };
}

// Ordem de habilidades do campeão na rota; sem partidas suficientes na rota, usa as partidas do
// campeão em qualquer rota (a ordem pouco muda entre rotas). null quando nenhuma serve.
export function summarizeSkillOrder(
  matches: MatchSample[],
  { championId, lane }: { championId: string; lane: Lane },
): SkillOrderSummary | null {
  const players = matches.flatMap((match) =>
    match.participants.filter((p) => p.championId === championId && p.timeline?.skillOrder?.length),
  );
  const orders = (list: ParticipantSample[]) => list.map((p) => p.timeline!.skillOrder!);

  const inLane = players.filter((p) => p.lane === lane);
  for (const [scope, list] of [
    ['lane', inLane],
    ['champion', players],
  ] as const) {
    const { levels, priority } = mostCommonSkillOrder(orders(list));
    if (levels.length > 0) return { scope, matches: list.length, levels, priority };
  }
  return null;
}

// Estatísticas determinísticas das partidas de alto elo para um campeão em uma rota.
// Devolve null quando nenhuma partida coletada tem esse campeão nessa rota.
export function summarizeHighElo(
  matches: MatchSample[],
  { championId, lane, enemies, allowedItemIds, starterItemIds }: HighEloQuery,
): HighEloSummary | null {
  const games: Game[] = [];
  for (const match of matches) {
    const player = match.participants.find((p) => p.championId === championId && p.lane === lane);
    if (!player) continue;
    games.push({
      patch: match.patch,
      player,
      enemies: match.participants.filter((p) => p.teamId !== player.teamId),
    });
  }
  if (games.length === 0) return null;

  return {
    matches: games.length,
    wins: wins(games),
    patches: [...new Set(games.map((game) => game.patch))].sort(),
    items: itemUsage(games, allowedItemIds, TOP_ITEMS),
    keystones: count(
      games,
      (game) => [game.player.runes],
      (runes) => runes.keystoneId,
    )
      .slice(0, TOP_KEYSTONES)
      .map(({ value, matches, wins }) => ({
        keystoneId: value.keystoneId,
        primaryTreeId: value.primaryTreeId,
        matches,
        wins,
      })),
    runePages: count(games, (game) => [game.player.runes], pageKey)
      .slice(0, TOP_RUNE_PAGES)
      .map(({ value, matches, wins }) => ({ page: value, matches, wins })),
    buildPath: buildPath(games, allowedItemIds, starterItemIds),
    versusEnemies: enemies.map((enemy) => {
      // O oponente direto só conta na mesma rota; os demais, em qualquer rota do time inimigo.
      const laneOpponent = enemy.lane === lane;
      const faced = games.filter((game) =>
        game.enemies.some(
          (p) => p.championId === enemy.championId && (!laneOpponent || p.lane === lane),
        ),
      );
      return {
        championId: enemy.championId,
        laneOpponent,
        matches: faced.length,
        wins: wins(faced),
        items: itemUsage(faced, allowedItemIds, TOP_ITEMS_VERSUS_ENEMY),
      };
    }),
  };
}
