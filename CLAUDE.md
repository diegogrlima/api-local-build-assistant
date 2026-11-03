# api-lol-build-assistant

API backend do **assistente de builds de League of Legends (LoL)**. O objetivo do produto é ajudar o jogador a escolher uma build adequada para a partida atual.

> Estado atual: MVP funcional. `GET /champions` lista os campeões e `POST /builds/recommendations` valida a entrada (campeões e rotas) e gera a build e a página de runas com o Gemini, usando como contexto os dados do Data Dragon e as estatísticas de partidas ranqueadas de Challenger e Grão-Mestre (API da Riot: League-V4 e Match-V5).

## Escopo do MVP (definição funcional do produto)

Este bloco define **o que o produto deve fazer**, não como construir. Antes de implementar qualquer funcionalidade, confira se ela está dentro deste escopo. **Não acrescente funcionalidades por iniciativa própria nem amplie o MVP sem decisão explícita do responsável pelo projeto.** Decisões de tecnologia e arquitetura são tratadas separadamente (seções abaixo).

### Visão e objetivo

O assistente analisa o campeão do jogador e os **cinco campeões adversários**, com a rota de cada um, e recomenda **uma única build** e **uma única página de runas**, adaptadas às ameaças encontradas naquela partida. Funciona como apoio à decisão: uma recomendação acompanhada de justificativas claras.

A recomendação deve equilibrar:

- **Força:** capacidade de causar dano e cumprir o papel do campeão.
- **Proteção:** capacidade de sobreviver às principais ameaças da partida.
- **Adaptação:** itens coerentes com os adversários enfrentados.

Não deve ser uma build padrão nem uma lista genérica de itens.

### Entrada do jogador

- O campeão que está utilizando e a rota dele (topo, selva, meio, atirador ou suporte).
- Os cinco campeões da equipe adversária, cada um com a sua rota (sem repetir rotas entre eles).

As rotas são obrigatórias. O adversário na mesma rota do jogador é o oponente direto.

**Não solicitar informações sobre os aliados.** A composição aliada não faz parte do MVP.

### Análise da partida

1. Identificar as principais ameaças dos cinco adversários.
2. Avaliar quais características inimigas mais influenciam a escolha dos itens.
3. Considerar o campeão do jogador, sua função e sua rota, dando peso ao oponente direto.
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
- **Runas:** árvore primária (runa principal e uma runa de cada linha) e árvore secundária (2 runas de linhas diferentes), com justificativa. Os fragmentos de atributo ficam de fora, porque o Data Dragon não os publica.

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

O MVP está funcional quando o jogador consegue: informar seu campeão e sua rota, informar os cinco adversários e as rotas deles, solicitar a análise, receber uma única build e uma página de runas adaptadas àquela composição e entender por que foram recomendadas.

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

Copie `.env.example` para `.env` antes de rodar. Variáveis: `NODE_ENV`, `HOST`, `PORT` (padrão 3333), `LOG_LEVEL`, `CORS_ORIGIN` (origens permitidas, separadas por vírgula; padrão `http://localhost:5173,http://127.0.0.1:5173`), `CATALOG_REFRESH_INTERVAL_MS` (intervalo de atualização dos catálogos do Data Dragon), `GEMINI_API_KEY` (opcional; sem ela a recomendação responde 503), `GEMINI_MODEL`, `RIOT_API_KEY` (opcional; chave de desenvolvimento expira em 24h e a de produção ainda não foi solicitada; sem ela a recomendação usa só o contexto do Data Dragon), `TRUST_PROXY` (padrão false; true atrás de proxy), `RATE_LIMIT_MAX` e `RECOMMENDATION_RATE_LIMIT_MAX` (requisições por IP por minuto; padrão 120 e 8), `RIOT_PLATFORM` (padrão `br1`), `HIGH_ELO_REFRESH_INTERVAL_MS` (intervalo entre ciclos de coleta) e `HIGH_ELO_DATA_FILE` (arquivo das partidas coletadas, padrão `data/high-elo-matches.json`, fora do git). Segredos vão só no `.env`, nunca no `.env.example`.

Snapshots de fallback dos catálogos: `npm run snapshot:champions`, `npm run snapshot:champion-details`, `npm run snapshot:items` e `npm run snapshot:runes` (rodar quando sair um patch novo).

## Recomendação com IA

A IA só escolhe e explica; ela nunca é fonte de dados. Fluxo em `src/modules/builds/recommendation-service.ts`:

1. `validateMatchupInput` valida a entrada (entrada inválida nunca chega à IA).
2. Contexto fechado: detalhes dos campeões (`championFull.json`) com as rotas e o oponente direto, análise determinística da composição inimiga (`matchup-analysis.ts`), lista de itens permitidos, árvores de runas (`runesReforged.json`) e as estatísticas de alto elo do campeão na rota (`dadosAltoElo`, de `high-elo-stats.ts`: uso e vitória de itens e runas, e o que foi usado contra cada adversário). A IA parte dessas escolhas e justifica os desvios pela composição inimiga.
3. O schema de resposta usa `enum` com os ids de itens permitidos, dos adversários, das árvores e das runas.
4. `recommendation-validator.ts` confere a resposta (6 itens existentes, sem repetição, no máximo 1 par de botas, ameaças entre os adversários; runa principal da árvore primária, uma runa de cada linha na primária, secundária diferente com 2 runas de linhas diferentes; compra inicial de `starter-items.ts` com até 500 de ouro, exatamente 1 companheiro na selva e 1 item de suporte no suporte, e nenhum deles nas outras rotas). Uma nova tentativa com o feedback; se falhar de novo, 502. Nada não validado chega ao jogador.

A IA fica atrás da interface `BuildAdvisor`; testes nunca chamam o Gemini (use `buildTestApp` de `src/test/build-test-app.ts`).

## Dados de alto elo

Módulo `src/modules/high-elo/`. A chave pessoal da Riot permite só 100 chamadas a cada 2 minutos, então a recomendação **nunca chama a Riot na hora**:

- `HighEloCollector` roda em segundo plano (fora dos testes): busca os jogadores de Challenger e Grão-Mestre, avança 40 jogadores por ciclo e guarda as partidas solo/duo novas (`riot-match-parser.ts` descarta outras filas, remakes e partidas sem rota). Para cada partida nova também busca a timeline (`riot-timeline-parser.ts`: compra inicial, momento de compra de cada item final e ordem dos pontos de habilidade); se a timeline falhar, a partida é guardada sem os tempos. A cada ciclo, até 40 partidas já guardadas sem a timeline completa também a recebem (`MatchStore.withoutTimeline`).
- `MatchStore` mantém as partidas dos 2 patches mais recentes em memória e no `HIGH_ELO_DATA_FILE`, para não perder a coleta ao reiniciar.
- `summarizeHighElo` calcula as estatísticas na hora da recomendação; a resposta traz `highElo` (amostra usada), `highEloPickRate` por item e o caminho da build: `starterItems` (compra inicial mais comum) e `highEloSecond` (segundo mediano em que o alto elo completa o 1º, 2º... item). Cada item traz `components` (receita direta do Data Dragon, do mais barato ao mais caro), para mostrar o que comprar antes de fechar o item. A resposta também traz `skillOrder` (`summarizeSkillOrder`): a sequência de habilidades mais comum do campeão na rota (`source: 'lane'`) ou, sem dados na rota, em qualquer rota (`'champion'`), montada nível a nível até restarem menos de 3 partidas no mesmo caminho, com a prioridade derivada dela. Só quando nenhuma partida tem a ordem, o schema pede `skillPriority` à IA (Q, W e E, validados) e a resposta vem com `source: 'ai'`. Os níveis que faltam até o 18 são completados por `skill-order.ts` (ultimate nos níveis 6, 11 e 16, as três básicas abertas até o nível 3 e depois a prioridade, até metade do nível em pontos); `observedLevels` diz quantos vieram das partidas. Campeões com pontos fora do padrão 5/5/5/3 (`maxRank` do Data Dragon: Udyr, Jayce, Elise...) mostram só os níveis das partidas. O catálogo inclui itens iniciais e componentes com `isBuildItem: false`: eles nunca entram na build, mas a IA escolhe a compra inicial (`starterItems` e `starterReason`) entre os candidatos de `starterCandidates`, partindo da compra mais usada no alto elo.
- `src/shared/riot-api/` tem o cliente com limitador por região e nova tentativa após 429. Testes usam `HighEloApi` fake; `buildTestApp` desliga o alto elo.

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
