import { z } from 'zod';
import { RIOT_PLATFORMS } from '../shared/riot-api/riot-platform.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CATALOG_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
  // Origens permitidas pelo CORS, separadas por vírgula.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  // Sem chave, a API sobe normalmente, mas a recomendação responde 503.
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  // Sem chave, a recomendação funciona só com o Data Dragon, sem os dados de alto elo.
  RIOT_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  RIOT_PLATFORM: z.enum(RIOT_PLATFORMS).default('br1'),
  // Intervalo entre os ciclos de coleta das partidas de Challenger e Grão-Mestre.
  HIGH_ELO_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(1_800_000),
  // Arquivo onde as partidas coletadas são guardadas entre reinícios.
  HIGH_ELO_DATA_FILE: z.string().min(1).default('data/high-elo-matches.json'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
