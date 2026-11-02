# api-lol-build-assistant

API backend do **assistente de builds de League of Legends (LoL)**. O objetivo do produto é ajudar o jogador a escolher uma build adequada para a partida atual.

> Estado atual: MVP funcional. `GET /champions` lista os campeões e `POST /builds/recommendations` valida a entrada e gera a build com o Gemini, usando apenas dados do Data Dragon como contexto. Fora do MVP, por ora: estatísticas de alto elo via API da Riot (Match-V5) como contexto extra.

## Escopo do MVP (definição funcional do produto)

Este bloco define **o que o produto deve fazer**, não como construir. Antes de implementar qualquer funcionalidade, confira se ela está dentro deste escopo. **Não acrescente funcionalidades por iniciativa própria nem amplie o MVP sem decisão explícita do responsável pelo projeto.** Decisões de tecnologia e arquitetura são tratadas separadamente (seções abaixo).

### Visão e objetivo

O assistente analisa o campeão do jogador e os **cinco campeões adversários** e recomenda **uma única build**, adaptada às ameaças encontradas naquela partida. Funciona como apoio à decisão: uma recomendação acompanhada de justificativas claras.

A recomendação deve equilibrar:

- **Força:** capacidade de causar dano e cumprir o papel do campeão.
- **Proteção:** capacidade de sobreviver às principais ameaças da partida.
- **Adaptação:** itens coerentes com os adversários enfrentados.

Não deve ser uma build padrão nem uma lista genérica de itens.

### Entrada do jogador

- O campeão que está utilizando.
- Os cinco campeões da equipe adversária.

**Não solicitar informações sobre os aliados.** A composição aliada não faz parte do MVP.

### Análise da partida

1. Identificar as principais ameaças dos cinco adversários.
2. Avaliar quais características inimigas mais influenciam a escolha dos itens.
3. Considerar o campeão do jogador e sua função na partida.
4. Identificar necessidades de dano, resistência e sobrevivência.
5. Montar uma recomendação coerente com o confronto.

A análise deve ser específica para os campeões informados, sem justificativas genéricas.

### Estilo de recomendação: Adaptive

A seleção de itens muda conforme as ameaças da composição inimiga. Critérios de análise (não regras fixas):

- Muito dano mágico → considerar proteção adequada contra esse tipo de dano.
- Muito dano físico → considerar proteção apropriada.
- Muita cura → avaliar redução de cura.
- Muito controle de grupo → considerar formas de lidar com ele.
- Grande potencial de explosão de dano → considerar alternativas que aumentem a sobrevivência.

Considere sempre o conjunto da composição inimiga e o campeão do jogador.

### Resultado apresentado

Uma **única build recomendada**, contendo:

- **Build recomendada:** itens a buscar.
- **Justificativa:** por que é adequada contra os adversários informados.
- **Ameaças consideradas:** campeões ou características inimigas que mais influenciaram.
- **Equilíbrio da escolha:** como a build mantém força e proteção.
- **Ordem de compra:** sequência sugerida de aquisição.

A resposta deve ser clara, prática e fácil de consultar antes da partida.

### Fora do escopo

- Analisar a composição dos aliados ou pedir informações sobre eles.
- Acompanhar continuamente compras ou inventários dos adversários.
- Alterar a recomendação durante a partida ou monitorar a partida em tempo real.
- Oferecer várias builds alternativas para o jogador escolher.
- Jogar pelo usuário ou interferir diretamente na partida.

A recomendação é baseada apenas nas informações fornecidas para aquela análise.

### Princípios de comportamento

- Priorizar qualidade e coerência da recomendação.
- Adaptar a escolha à composição inimiga, em vez de repetir uma build padrão.
- Explicar as decisões em linguagem simples e direta.
- Não afirmar que uma build garante a vitória.
- **Não inventar dados** sobre campeões, itens ou efeitos.
- Sinalizar quando não houver informação suficiente para sustentar uma recomendação.
- Manter o foco no campeão do jogador e nos cinco adversários informados.

### Critério de conclusão

O MVP está funcional quando o jogador consegue: informar seu campeão, informar os cinco adversários, solicitar a análise, receber uma única build adaptada àquela composição e entender por que os itens foram recomendados.

## Stack

- Node.js >= 22 (ver `.nvmrc`), ESM (`"type": "module"`)
- TypeScript, Fastify 5, `@fastify/sensible`
- Zod 4 para validação (env e, futuramente, schemas de rotas)
- Vitest para testes; ESLint + Prettier; Husky + commitlint + lint-staged

## Comandos

| Comando                                 | O que faz                              |
| --------------------------------------- | -------------------------------------- |
| `npm run dev`                           | Servidor com hot reload (tsx)          |
| `npm run build` / `npm start`           | Compila para `dist/` / executa o build |
| `npm test`                              | Testes (Vitest, execução única)        |
| `npm run typecheck`                     | `tsc --noEmit`                         |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                      |

Copie `.env.example` para `.env` antes de rodar. Variáveis: `NODE_ENV`, `HOST`, `PORT` (padrão 3333), `LOG_LEVEL`, `CORS_ORIGIN` (origens permitidas, separadas por vírgula; padrão `http://localhost:5173,http://127.0.0.1:5173`), `CATALOG_REFRESH_INTERVAL_MS` (intervalo de atualização dos catálogos do Data Dragon), `GEMINI_API_KEY` (opcional; sem ela a recomendação responde 503) e `GEMINI_MODEL`. Segredos vão só no `.env`, nunca no `.env.example`.

Snapshots de fallback dos catálogos: `npm run snapshot:champions`, `npm run snapshot:champion-details` e `npm run snapshot:items` (rodar quando sair um patch novo).

## Recomendação com IA

A IA só escolhe e explica; ela nunca é fonte de dados. Fluxo em `src/modules/builds/recommendation-service.ts`:

1. `validateMatchupInput` valida a entrada (entrada inválida nunca chega à IA).
2. Contexto fechado: detalhes dos campeões (`championFull.json`), análise determinística da composição inimiga (`matchup-analysis.ts`) e lista de itens permitidos.
3. O schema de resposta usa `enum` com os ids de itens permitidos e dos adversários.
4. `recommendation-validator.ts` confere a resposta (6 itens existentes, sem repetição, no máximo 1 par de botas, ameaças entre os adversários). Uma nova tentativa com o feedback; se falhar de novo, 502. Nada não validado chega ao jogador.

A IA fica atrás da interface `BuildAdvisor`; testes nunca chamam o Gemini (use `buildTestApp` de `src/test/build-test-app.ts`).

## Arquitetura

Arquitetura modular sobre Fastify:

- `src/server.ts` — bootstrap e graceful shutdown
- `src/app.ts` — `buildApp(env)`, factory do Fastify usada pelo servidor **e pelos testes**; registra plugins e rotas dos módulos
- `src/config/env.ts` — `loadEnv()` valida variáveis de ambiente com Zod; falha cedo se inválidas
- `src/plugins/` — plugins transversais (ex.: `error-handler.ts`)
- `src/shared/` — código compartilhado entre módulos (ex.: `errors/app-error.ts`, `ddragon/` para acesso ao Data Dragon, `catalog/in-memory-catalog.ts` com cache, snapshot e refresh)
- `src/test/` — helpers de teste (fakes de providers); fora do build
- `src/modules/<nome>/` — um diretório por módulo, com rotas (`*.routes.ts`), serviço, schemas e testes

## Convenções

- Imports relativos usam extensão `.js` (ESM com TypeScript), ex.: `'./config/env.js'`.
- Cada módulo expõe um `FastifyPluginAsync` (ex.: `healthRoutes`) registrado em `buildApp`.
- Erros de negócio: lance `AppError(message, statusCode, code)`; o error handler converte para `{ code, message }`. Erros 5xx são logados e retornam mensagem genérica (`INTERNAL_SERVER_ERROR`).
- Testes ficam ao lado do código (`*.test.ts`) e usam `buildApp` com `NODE_ENV: 'test'` (logger desligado), via `app.inject()`.
- Mensagens de erro e textos voltados ao usuário em português (pt-BR).
- Commits em Conventional Commits (`feat:`, `fix:`, `chore:`...), validados pelo commitlint. O hook `pre-commit` roda lint-staged, typecheck e testes — não use `--no-verify`.

## Ao adicionar uma funcionalidade

1. Crie `src/modules/<nome>/` com `<nome>.routes.ts` (e serviço/schemas se necessário) e `<nome>.routes.test.ts`.
2. Valide entrada/saída com Zod.
3. Registre o plugin em `src/app.ts`.
4. Rode `npm run typecheck && npm run lint && npm test` antes de commitar.
