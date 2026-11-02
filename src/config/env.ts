import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CATALOG_REFRESH_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
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
