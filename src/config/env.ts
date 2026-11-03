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
  // Confia nos cabeçalhos X-Forwarded-* (necessário atrás de proxy/PaaS para o limite por IP funcionar).
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Limite de requisições por IP por minuto: geral e para a recomendação (que consome a cota da Gemini).
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RECOMMENDATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),
  // Sem chave, a API sobe normalmente, mas a recomendação responde 503.
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  // ATENÇÃO: a chave de desenvolvimento da Riot expira a cada 24h e a chave de produção ainda não
  // foi solicitada (projeto de portfólio). Sem chave, a recomendação funciona só com o contexto do
  // Data Dragon (campeões, itens e runas), sem os dados de alto elo. Solicite a chave de produção
  // quando for publicar de forma definitiva.
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
