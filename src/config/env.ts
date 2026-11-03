import { z } from 'zod';

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
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
