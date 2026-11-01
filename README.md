# api-lol-build-assistant

Backend em Fastify + TypeScript com arquitetura modular.

## Scripts

| Comando             | Descrição                  |
| ------------------- | -------------------------- |
| `npm run dev`       | Servidor com hot reload    |
| `npm run build`     | Compila para `dist/`       |
| `npm start`         | Executa o build            |
| `npm test`          | Executa os testes (Vitest) |
| `npm run typecheck` | Verifica tipos             |
| `npm run lint`      | ESLint                     |

Copie `.env.example` para `.env` antes de rodar.

## Estrutura

- `src/app.ts` — factory do Fastify (usada pelo servidor e pelos testes)
- `src/server.ts` — bootstrap e graceful shutdown
- `src/config/` — validação de variáveis de ambiente
- `src/plugins/` — plugins/infra transversais
- `src/shared/` — código compartilhado entre módulos
- `src/modules/<nome>/` — um diretório por módulo (rotas, serviço, schemas, testes)

## Commits

Conventional Commits, validados pelo commitlint (`feat:`, `fix:`, `chore:`...).
O hook `pre-commit` roda lint-staged, typecheck e testes.
