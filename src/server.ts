import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await buildApp(env);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} recebido, encerrando...`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
