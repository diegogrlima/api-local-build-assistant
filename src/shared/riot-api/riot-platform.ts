// Plataformas de LoL e a região que serve a Match-V5 de cada uma.
const REGION_BY_PLATFORM = {
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  na1: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  me1: 'europe',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea',
  sg2: 'sea',
  tw2: 'sea',
  vn2: 'sea',
} as const;

export type RiotPlatform = keyof typeof REGION_BY_PLATFORM;

export const RIOT_PLATFORMS = Object.keys(REGION_BY_PLATFORM) as [RiotPlatform, ...RiotPlatform[]];

export function platformHost(platform: RiotPlatform): string {
  return `https://${platform}.api.riotgames.com`;
}

export function regionHost(platform: RiotPlatform): string {
  return `https://${REGION_BY_PLATFORM[platform]}.api.riotgames.com`;
}
