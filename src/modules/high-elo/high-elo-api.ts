import { z } from 'zod';
import type { RiotApiClient } from '../../shared/riot-api/riot-api-client.js';
import {
  platformHost,
  regionHost,
  type RiotPlatform,
} from '../../shared/riot-api/riot-platform.js';
import { RANKED_SOLO_QUEUE_ID } from './riot-match-parser.js';

export const HIGH_ELO_TIERS = ['CHALLENGER', 'GRANDMASTER'] as const;

// Fonte dos dados de alto elo. Não faz cache; quem chama controla o ritmo.
export interface HighEloApi {
  // PUUIDs dos jogadores de Challenger e Grão-Mestre, do maior para o menor PDL.
  fetchHighEloPlayers(signal?: AbortSignal): Promise<string[]>;
  fetchRankedMatchIds(puuid: string, count: number, signal?: AbortSignal): Promise<string[]>;
  // Resposta crua da Match-V5; quem chama converte com parseMatch.
  fetchMatch(matchId: string, signal?: AbortSignal): Promise<unknown>;
  // Resposta crua da timeline da Match-V5; quem chama converte com addPurchaseTimeline.
  fetchMatchTimeline(matchId: string, signal?: AbortSignal): Promise<unknown>;
}

const leagueSchema = z.object({
  entries: z.array(z.object({ puuid: z.string().min(1), leaguePoints: z.number() })),
});

const matchIdsSchema = z.array(z.string());

const LEAGUE_PATHS: Record<(typeof HIGH_ELO_TIERS)[number], string> = {
  CHALLENGER: '/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5',
  GRANDMASTER: '/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5',
};

export class RiotHighEloApi implements HighEloApi {
  constructor(
    private readonly client: RiotApiClient,
    private readonly platform: RiotPlatform,
  ) {}

  async fetchHighEloPlayers(signal?: AbortSignal): Promise<string[]> {
    const leagues = await Promise.all(
      HIGH_ELO_TIERS.map(async (tier) =>
        leagueSchema.parse(
          await this.client.get(platformHost(this.platform), LEAGUE_PATHS[tier], signal),
        ),
      ),
    );

    return leagues
      .flatMap((league) => league.entries)
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .map((entry) => entry.puuid);
  }

  async fetchRankedMatchIds(puuid: string, count: number, signal?: AbortSignal): Promise<string[]> {
    const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${RANKED_SOLO_QUEUE_ID}&type=ranked&count=${count}`;
    return matchIdsSchema.parse(await this.client.get(regionHost(this.platform), path, signal));
  }

  fetchMatch(matchId: string, signal?: AbortSignal): Promise<unknown> {
    return this.client.get(
      regionHost(this.platform),
      `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
      signal,
    );
  }

  fetchMatchTimeline(matchId: string, signal?: AbortSignal): Promise<unknown> {
    return this.client.get(
      regionHost(this.platform),
      `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
      signal,
    );
  }
}
