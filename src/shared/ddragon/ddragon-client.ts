import { z } from 'zod';

export const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
export const DDRAGON_LOCALE = 'pt_BR';
const TIMEOUT_MS = 5000;

const versionSchema = z.array(z.string().min(1));

export async function fetchLatestVersion(): Promise<string> {
  const versions = await fetchJson(`${DDRAGON_BASE_URL}/api/versions.json`);

  const version = versionSchema.parse(versions)[0];

  if (!version) {
    throw new Error('No versions available from Riot.');
  }

  return version;
}

export function dataUrl(version: string, file: string): string {
  return `${DDRAGON_BASE_URL}/cdn/${version}/data/${DDRAGON_LOCALE}/${file}`;
}

export function imageUrl(version: string, group: string, file: string): string {
  return `${DDRAGON_BASE_URL}/cdn/${version}/img/${group}/${file}`;
}

export async function fetchJson(url: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Timeout accessing ${url}`, {
        cause: error,
      });
    }

    throw new Error(`Network failure when accessing ${url}`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} when accessing ${url}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Invalid JSON response from ${url}`, {
      cause: error,
    });
  }
}
