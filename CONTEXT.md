# CONTEXTO DO PROJETO

## 1) Panorama do Workspace

### Escopo real do workspace
- Workspace atual: `c:\Users\WINDOWS\OneDrive\Documentos\amanda-content`
- Projeto principal (e unico nesta pasta): `v.1-ide-vscode-remix-of-ai-content-forge`
- Conclusao: hoje o workspace concentra este app como foco principal.

### Objetivo do produto (estado atual)
Aplicacao web orientada a criacao e operacao de conteudo com:
- chat com agentes especializados;
- pesquisa de mercado;
- checklist de implementacao;
- aulas internas;
- dashboard de metricas;
- calendario de eventos;
- feed de tendencias.

### Stack principal
- Frontend: React 18 + Vite + TypeScript + Tailwind + shadcn/ui.
- Estado: Zustand (`src/stores/chatStore.ts`) + estado local React.
- Dados cliente-servidor: Supabase JS (`src/integrations/supabase/client.ts`).
- Backend: Supabase Edge Functions (`supabase/functions/*`).
- Banco: Postgres Supabase + RLS + RPCs.
- Projeto Supabase configurado em `supabase/config.toml` (`project_id = "wsybajljuhcvvehnxads"`).

---

## 2) Arquitetura da Aplicacao

### Entrada e providers
- Entry point: `src/main.tsx`
- App raiz: `src/App.tsx`
- Providers globais:
  - `QueryClientProvider` (React Query);
  - `AuthProvider` (`src/contexts/AuthContext.tsx`);
  - `TooltipProvider`;
  - Toasters.

### Roteamento
- Router real de URL:
  - `/` -> `src/pages/Index.tsx`
  - `*` -> `src/pages/NotFound.tsx`
- Navegacao funcional da app acontece por estado interno em `useChatStore().activePage`, nao por rotas URL por modulo.

### Fluxo macro de render
- `Index.tsx` decide qual pagina renderizar com `switch(activePage)`:
  - `home`, `market-research`, `creator-kit`, `implementation`, `aulas`, `metrics`, `calendario`, `news-feed`, ou `chat` (ChatArea).
- Sidebar controla `activePage` e `activeAgentId` (`src/components/layout/Sidebar.tsx`).

### Estado global de chat
Arquivo: `src/stores/chatStore.ts`

Responsabilidades principais:
- conversas (`conversations`), conversa ativa, agente ativo;
- pagina ativa (`activePage`);
- modelo selecionado (`selectedModel`);
- modo de raciocinio (`thinkingMode`);
- sidebar aberta/fechada.

### Backend na arquitetura
- Chamadas via `supabase.functions.invoke(...)` em:
  - `src/services/chatService.ts` -> `chat`;
  - `src/pages/ImplementationPage.tsx` -> `sync-implementation`;
  - `src/pages/NewsFeedPage.tsx` -> `search-trends`;
  - `src/hooks/useCalendarEvents.ts` -> `calendar-events`.
- Pesquisa de mercado tambem chama webhooks externos diretamente (Make), sem passar por Edge Function da app em parte do fluxo.

---

## 3) Modulos de Negocio (foco funcional)

### 3.1 Chat (Home + Agentes)

Arquivos-chave:
- Home chat: `src/pages/HomePage.tsx`
- Chat por agente: `src/components/chat/ChatArea.tsx`
- Input: `src/components/chat/ChatInput.tsx`
- Service: `src/services/chatService.ts`
- Modelos: `src/config/models.ts`
- Tipos/agentes: `src/types/index.ts`

Comportamento:
- Home usa estado local de mensagens e envia com `agentId: 'brand-book'`.
- ChatArea usa conversas no Zustand e respeita `activeAgentId`.
- Prompt de sistema por agente em `AGENT_SYSTEM_PROMPTS` (`chatService.ts`).
- Se `extendedThinking` estiver ativo e o modelo suportar, envia flag para backend.

Observacao tecnica importante:
- UI oferece modelos OpenAI/Claude/Gemini (`src/config/models.ts`), mas a Edge Function `chat` usa SDK Anthropic (`supabase/functions/chat/index.ts`), o que indica risco de incompatibilidade para modelos nao Anthropic.

### 3.2 CreatorFounder Kit

Arquivo:
- `src/pages/CreatorKitPage.tsx`

Comportamento:
- Organiza agentes por secoes;
- busca local por nome/descricao;
- ao clicar, troca para `activeAgentId` e abre chat do agente.

### 3.3 Pesquisa de Mercado

Arquivos-chave:
- UI: `src/pages/MarketResearchPage.tsx`
- Hook: `src/hooks/useMarketResearch.ts`
- API local: `src/services/marketResearchApi.ts`
- Tipos: `src/types/marketResearch.ts`
- Callback/status: `supabase/functions/pesquisa-callback/index.ts` e `supabase/functions/pesquisa-status/index.ts`

Comportamento atual:
- `MarketResearchPage` dispara webhook Make (`hook.us1...`) e faz polling em `pesquisa-status`.
- Em paralelo, chama `search(filters)` do hook, que usa `marketResearchApi.ts` e dispara outro webhook (`hook.us2...`).
- Resultado exibido vem do retorno normalizado no hook/service, com ordenacao client-side.

Risco funcional:
- Duplicidade de pipelines/webhooks e possivel divergencia de resultados.

### 3.4 Implementation Checklist

Arquivos-chave:
- UI: `src/pages/ImplementationPage.tsx`
- Edge sync: `supabase/functions/sync-implementation/index.ts`
- Tabela: `implementation_tasks` (migrations + types Supabase)

Comportamento:
- Carrega tarefas da tabela `implementation_tasks`.
- Sincroniza planilha CSV publica via Edge Function.
- URL da planilha fica em `localStorage` (`implementation_sheet_url`).

### 3.5 Aulas

Arquivos-chave:
- Pagina: `src/pages/AulasPage.tsx`
- Hook: `src/hooks/useLessons.ts`
- Admin panel: `src/components/aulas/AulasAdminPanel.tsx`
- Role check: `src/hooks/useIsAdmin.ts` (RPC `has_role`)
- Tabelas: `lesson_modules`, `lessons`, `user_lesson_progress`

Comportamento:
- Lista modulos/aulas;
- reproduz video Loom;
- marca progresso por usuario autenticado;
- painel admin permite CRUD em modulos/aulas.

### 3.6 Metricas

Arquivos-chave:
- Pagina: `src/pages/MetricsDashboard.tsx`
- Hook: `src/hooks/useMetrics.ts`
- Ingestao externa: `supabase/functions/airtable-webhook/index.ts`
- Tabela: `client_metrics`

Comportamento:
- Calcula periodo (mes, range, quarter, ano);
- agrega/soma media no frontend quando necessario;
- compara com periodo anterior (quando aplicavel);
- renderiza cards e graficos.

### 3.7 Calendario

Arquivos-chave:
- Pagina: `src/pages/CalendarPage.tsx`
- Hook: `src/hooks/useCalendarEvents.ts`
- Edge: `supabase/functions/calendar-events/index.ts`

Comportamento:
- Busca eventos via AddEvent API;
- fallback para iCal publico `.ics`;
- filtra por mes e dia no frontend.

### 3.8 News Feed (tendencias)

Arquivos-chave:
- Pagina: `src/pages/NewsFeedPage.tsx`
- Edge: `supabase/functions/search-trends/index.ts`

Comportamento:
- Usuario informa mercado/nicho;
- função chama OpenRouter (`perplexity/sonar`);
- espera JSON com 4 blocos de tendencias.

---

## 4) Dados e Banco (Supabase)

Fonte de verdade de tipos:
- `src/integrations/supabase/types.ts`

Migrations relevantes:
- `supabase/migrations/20260223041547_6c2c1f44-f402-4f6f-a968-65e0db156ba3.sql`
- `supabase/migrations/20260312034316_9297c7a4-e500-4471-b2a0-fc76b301a906.sql`
- `supabase/migrations/20260312152948_3265f13c-5cad-4c2a-a870-0b8e6802045c.sql`
- `supabase/migrations/20260328035517_51cf7c12-647b-4d2d-b8a7-04ed4474578e.sql`
- `supabase/migrations/20260328042817_5f60db3b-d290-4adb-b71a-fac3ab569e51.sql`
- `supabase/migrations/20260328134605_062762df-edab-4ee1-ba9a-ddc209f0c7d6.sql`

### Tabelas principais em uso no produto
- `client_metrics`: dashboard de metricas.
- `implementation_tasks`: checklist de implementacao.
- `lesson_modules`, `lessons`, `user_lesson_progress`: trilha de aulas.
- `pesquisa_callbacks`: confirmacao de callback de pesquisa.
- `documents`, `document_chunks`, `agent_prompts`: base para documentos/RAG/chat.
- `user_roles`: papeis de acesso.

### Tabelas presentes no schema, mas sem uso claro no frontend atual
- `user_feeds`
- `articles`
- `user_settings`

### RPCs/funcoes SQL usadas
- `has_role(_user_id, _role)`:
  - chamada em `src/hooks/useIsAdmin.ts`.
- `search_documents(...)`:
  - usada na função `chat` para RAG (`supabase/functions/chat/index.ts`).

### RLS (resumo operacional)
- RLS habilitado para tabelas sensiveis e politicas por usuario em varios dominos.
- Destaques:
  - Documentos/chunks por `auth.uid() = user_id`.
  - `client_metrics` com politicas para dono/admin/service_role e leitura anon adicionada.
  - `implementation_tasks`: leitura autenticada, escrita service_role.
  - `lesson_modules`/`lessons`: leitura para autenticado (e tambem anon ativo), CRUD autenticado foi aberto em migration posterior.

---

## 5) Edge Functions e Integracoes Externas

### Mapa de funcoes

1. `chat` (`supabase/functions/chat/index.ts`)
- Chamador: `src/services/chatService.ts`
- Objetivo: gerar resposta do chat e injetar contexto RAG.
- Dependencias externas: Anthropic API, OpenAI Embeddings, Pinecone, Supabase DB.
- RAG: consulta primaria no Pinecone com fallback para `search_documents` no Supabase.

2. `search-trends` (`supabase/functions/search-trends/index.ts`)
- Chamador: `src/pages/NewsFeedPage.tsx`
- Objetivo: gerar tendencias por mercado/nicho.
- Dependencias externas: OpenRouter (`perplexity/sonar`).

3. `calendar-events` (`supabase/functions/calendar-events/index.ts`)
- Chamador: `src/hooks/useCalendarEvents.ts`
- Objetivo: obter eventos de calendario.
- Dependencias externas: AddEvent API + fallback iCal.

4. `sync-implementation` (`supabase/functions/sync-implementation/index.ts`)
- Chamador: `src/pages/ImplementationPage.tsx`
- Objetivo: importar CSV de Google Sheets para `implementation_tasks`.

5. `pesquisa-callback` (`supabase/functions/pesquisa-callback/index.ts`)
- Chamador esperado: automacao externa (Make).
- Objetivo: registrar callback de pesquisa em `pesquisa_callbacks`.

6. `pesquisa-status` (`supabase/functions/pesquisa-status/index.ts`)
- Chamador: `src/pages/MarketResearchPage.tsx` (polling).
- Objetivo: confirmar recebimento de callback por `requestId`.

7. `airtable-webhook` (`supabase/functions/airtable-webhook/index.ts`)
- Chamador esperado: Airtable/automacao externa.
- Objetivo: upsert de metricas em `client_metrics`.

8. `process-document` (`supabase/functions/process-document/index.ts`)
- Chamador: `src/components/modals/DocumentsModal.tsx`
- Objetivo: chunk + embedding + upsert vetorial no Pinecone.

9. `delete-document-vectors` (`supabase/functions/delete-document-vectors/index.ts`)
- Chamador: `src/components/modals/DocumentsModal.tsx`
- Objetivo: remover vetores do Pinecone ao excluir documento.

### Webhooks externos fora de Edge Function
- `src/pages/MarketResearchPage.tsx`: webhook Make `hook.us1...`
- `src/services/marketResearchApi.ts`: webhook Make `hook.us2...`

### Variaveis de ambiente (somente nomes)

Frontend (`.env` + `import.meta.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Edge Functions (`Deno.env.get`):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `OPENROUTER_API_KEY`
- `ADDEVENT_API_KEY`
- `ADDEVENT_CALENDAR_ID`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 6) Mapa de Maturidade (ativo, parcial, nao conectado)

### Ativo e conectado
- Navegacao central por sidebar + paginas internas (`src/pages/Index.tsx`).
- Chat funcional com chamada da edge function `chat`.
- Checklist de implementacao com sync por CSV.
- Aulas com progresso por usuario e painel de edicao.
- Dashboard de metricas carregando `client_metrics`.
- Calendario via edge function com fallback iCal.
- News Feed via `search-trends`.
- Documentos com persistencia em `documents` e indexacao RAG no Pinecone.

### Parcialmente implementado
- Pesquisa de mercado:
  - tem UI completa + polling callback + normalizacao de posts;
  - fluxo dividido em dois webhooks/pipelines.

### Nao conectado / placeholder
- `AuthPage` existe (`src/pages/AuthPage.tsx`), mas nao esta roteada em `App.tsx`.
- `AppsModal` usa lista estatica (`src/components/modals/AppsModal.tsx`).
- `ImagesModal` sem fonte real de dados (`src/components/modals/ImagesModal.tsx`).
- Tabelas `user_feeds`, `articles`, `user_settings` sem fluxo frontend identificado no estado atual.

---

## 7) Operacao Local

### Pre-requisitos
- Node.js + npm.
- Dependencias JS instaladas.
- Variaveis `VITE_*` configuradas.
- Opcional: Supabase CLI para operar funcoes/migrations localmente.

### Comandos do projeto
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Testes: `npm test` / `npm run test:watch`

### Estado observado nesta analise
- `npm run build` falhou com: `vite nao e reconhecido...`
- `npm test` falhou com: `vitest nao e reconhecido...`
- Causa provavel: dependencias nao instaladas localmente.
- Acao esperada: rodar `npm install` antes dos scripts.

### Troubleshooting rapido
- Erro de `vite/vitest` nao encontrado:
  - executar `npm install`.
- Tela sem dados Supabase:
  - validar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Pesquisa sem confirmacao:
  - checar webhook Make + callback `pesquisa-callback` + `VITE_SUPABASE_PROJECT_ID`.
- Calendario vazio:
  - validar `ADDEVENT_API_KEY`, `ADDEVENT_CALENDAR_ID` e permissao/plano AddEvent.

---

## 8) Riscos Tecnicos e Divida

1. **Mojibake/encoding em textos PT-BR**
- Evidencias em varios arquivos, por exemplo:
  - `src/services/chatService.ts`
  - `src/types/index.ts`
  - `src/pages/HomePage.tsx`
- Impacto: UX degradada e risco de inconsistencias de copy.

2. **Selecao de modelo na UI vs backend Anthropic-only**
- UI permite OpenAI/Gemini em `src/config/models.ts`.
- `chat` usa `Anthropic` SDK diretamente (`supabase/functions/chat/index.ts`).
- Impacto: possivel falha ao selecionar modelos nao Anthropic.

3. **Pesquisa de mercado com fluxo duplicado**
- `MarketResearchPage.tsx` envia webhook direto e ainda chama `search()` do hook.
- `search()` chama outro webhook via `src/services/marketResearchApi.ts`.
- Impacto: custo duplicado, estados inconsistentes e depuracao dificil.

4. **Autenticacao sem rota/guard principal**
- `AuthProvider` existe, mas `AuthPage` nao entra em rotas de `App.tsx`.
- Impacto: acesso amplo ao app sem gate explicito; comportamento dependente de cada tela.

5. **Dependencia forte de segredos para RAG Pinecone**
- Sem `PINECONE_*` e `OPENAI_API_KEY`, o pipeline de indexacao/consulta nao funciona.
- O chat cai para fallback no Supabase quando necessario.
- Impacto: degradacao de qualidade do contexto se o setup de segredos estiver incompleto.

6. **Baixa cobertura de testes**
- Apenas teste exemplo (`src/test/example.test.ts`).
- Impacto: regressao funcional com baixa deteccao automatica.

7. **Politicas amplas em modulos de aulas**
- Migrations permitem CRUD autenticado de `lesson_modules` e `lessons`.
- Impacto: superficie maior para alteracao de conteudo sem camada adicional no frontend.

---

## 9) Guia de Onboarding (rapido e pratico)

### Ordem recomendada de leitura do codigo
1. `src/App.tsx` e `src/pages/Index.tsx` (entender shell e navegacao interna).
2. `src/stores/chatStore.ts` (estado global).
3. `src/pages/*` dos modulos principais.
4. `src/services/chatService.ts` + `supabase/functions/chat/index.ts`.
5. `src/integrations/supabase/types.ts` + migrations.

### Para mexer em frontend de produto
- Paginas: `src/pages/*`
- Navegacao: `src/components/layout/Sidebar.tsx`
- Header/modelos: `src/components/layout/Header.tsx`
- Tema/tokens: `src/index.css`, `tailwind.config.ts`

### Para mexer em dados e backend
- Supabase client/types: `src/integrations/supabase/*`
- Edge functions: `supabase/functions/*`
- Schema/RLS/RPC: `supabase/migrations/*`

### Para evolucao segura (prioridade sugerida)
1. Corrigir fluxo de modelos do chat (provider-aware no backend).
2. Unificar pipeline de pesquisa de mercado em uma rota/fonte.
3. Melhorar parser de upload para PDF/DOCX (hoje leitura textual simples).
4. Integrar auth route/guards.
5. Expandir suite de testes alem do exemplo.

---

## 10) Referencias de Arquivos (indice rapido)

### Core app
- `src/main.tsx`
- `src/App.tsx`
- `src/pages/Index.tsx`
- `src/stores/chatStore.ts`

### Chat e agentes
- `src/services/chatService.ts`
- `src/config/models.ts`
- `src/types/index.ts`
- `src/components/chat/ChatArea.tsx`
- `supabase/functions/chat/index.ts`

### Modulos
- `src/pages/MarketResearchPage.tsx`
- `src/hooks/useMarketResearch.ts`
- `src/services/marketResearchApi.ts`
- `src/pages/ImplementationPage.tsx`
- `src/pages/AulasPage.tsx`
- `src/pages/MetricsDashboard.tsx`
- `src/pages/CalendarPage.tsx`
- `src/pages/NewsFeedPage.tsx`

### Supabase
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`
- `supabase/functions/*`
- `supabase/migrations/*`

### Operacao
- `package.json`
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `.env` (somente variaveis `VITE_*`)

---

## 11) Status deste documento
- Tipo: contexto tecnico-operacional consolidado.
- Idioma: Portugues.
- Escopo: workspace atual com foco no projeto `v.1-ide-vscode-remix-of-ai-content-forge`.
- Ultima consolidacao: 2026-03-30.
