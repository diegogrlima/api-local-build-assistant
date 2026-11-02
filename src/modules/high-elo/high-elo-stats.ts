import type { Lane } from '../champions/lane.js';
import type { MatchSample, ParticipantSample, RunePage } from './match-sample.js';

// Quantos itens e páginas de runas mais frequentes entram no resumo.
const TOP_ITEMS = 12;
const TOP_ITEMS_VERSUS_ENEMY = 6;
const TOP_KEYSTONES = 4;
const TOP_RUNE_PAGES = 3;

export type Usage = { matches: number; wins: number };

export type ItemUsage = Usage & { itemId: string };

export type HighEloSummary = Usage & {
  patches: string[];
  items: ItemUsage[];
  keystones: (Usage & { keystoneId: string; primaryTreeId: string })[];
  runePages: (Usage & { page: RunePage })[];
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

// Estatísticas determinísticas das partidas de alto elo para um campeão em uma rota.
// Devolve null quando nenhuma partida coletada tem esse campeão nessa rota.
export function summarizeHighElo(
  matches: MatchSample[],
  { championId, lane, enemies, allowedItemIds }: HighEloQuery,
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
