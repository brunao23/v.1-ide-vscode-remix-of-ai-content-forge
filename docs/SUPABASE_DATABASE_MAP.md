# Supabase: Mapa Completo do Banco e Provisionamento

Este documento consolida a estrutura atual do banco Supabase usada pelo projeto e serve como referencia para subir uma conta nova sem perder compatibilidade.

## 1) Origem da Estrutura

A estrutura abaixo vem das migrations em `supabase/migrations`:

- `20260223041547_6c2c1f44-f402-4f6f-a968-65e0db156ba3.sql`
- `20260312034316_9297c7a4-e500-4471-b2a0-fc76b301a906.sql`
- `20260312152948_3265f13c-5cad-4c2a-a870-0b8e6802045c.sql`
- `20260328035517_51cf7c12-647b-4d2d-b8a7-04ed4474578e.sql`
- `20260328040241_be8b8dad-6ce2-40b3-96d7-b27a24967768.sql`
- `20260328042817_5f60db3b-d290-4adb-b71a-fac3ab569e51.sql`
- `20260328043401_6d7bc670-c7d0-450b-8bf4-7ae7f2e32732.sql`
- `20260328043453_3ebd0c1c-d2fb-49d7-a069-1925d9dabeaf.sql`
- `20260328045851_91356f83-4b2a-4759-90b6-973d8b101a1b.sql`
- `20260328052435_639db33a-77b5-4a9e-a70f-774b4f9311bb.sql`
- `20260328134605_062762df-edab-4ee1-ba9a-ddc209f0c7d6.sql`
- `20260330193000_documentos_apify_upgrade.sql`

## 2) Extensoes, Enums e Bucket

- Extensao: `vector` (pgvector).
- Enum: `public.app_role` (`admin`, `moderator`, `user`).
- Bucket Storage: `documents` (privado, com policies por pasta `auth.uid()`).

## 3) Tabelas do Schema `public`

### 3.1 Nucleo de Documentos

- `documents`
  - Metadados e conteudo base de documentos do usuario.
  - Campos chave: `user_id`, `type`, `processing_status`, `processing_error`, `agent_id`.
- `document_chunks`
  - Chunks vetoriais ligados a `documents`.
  - Campos chave: `document_id`, `user_id`, `embedding vector(1536)`, `chunk_index`.
- `system_documents`
  - Documentos fixos de regras/guias por agente.
  - Campos chave: `applies_to_agents[]`, `is_mandatory`, `is_active`.

### 3.2 Configuracao de Agentes

- `agent_prompts`
  - Prompt sistemico por agente.
  - Campos chave: `agent_id`, `system_prompt`, `requires_documents[]`, `uses_documents_context`.
- `internal_api_keys`
  - Chaves internas de integracoes gerenciadas pelo lado ADM.
  - Campos chave: `key_name`, `secret_value`, `provider`, `is_active`.

### 3.3 Implementacao / Planejamento

- `implementation_tasks`
  - Itens de implementacao por mes/semana/tarefa.

### 3.4 Pesquisa e Feed

- `pesquisa_callbacks`
  - Controle de callbacks de pesquisa assincrona.
- `user_feeds`
  - Feeds cadastrados por usuario.
- `articles`
  - Artigos relacionados a `user_feeds`.
- `user_settings`
  - Configuracoes de mercado/nicho por usuario.

### 3.5 Aulas

- `lesson_modules`
  - Modulos das aulas.
- `lessons`
  - Aulas vinculadas a modulos (`module_id`).
- `user_lesson_progress`
  - Progresso por usuario e aula (`UNIQUE(user_id, lesson_id)`).

### 3.6 Metricas e Papeis

- `user_roles`
  - Papeis de acesso por usuario (`app_role`).
- `client_metrics`
  - Metricas financeiras, midia e retencao por periodo.
  - Observacao: a FK para `auth.users` foi removida por migration posterior.

## 4) Indices Importantes

- `documents`: `idx_documents_user_id`, `idx_documents_type`.
- `document_chunks`: `idx_document_chunks_document_id`, `idx_document_chunks_user_id`, `idx_document_chunks_embedding (hnsw vector_cosine_ops)`.
- `system_documents`: `idx_system_documents_active`, `idx_system_documents_agents (GIN em array)`.

## 5) Funcoes SQL/RPC e Triggers

- `public.search_documents(query_embedding, match_count, filter_user_id, filter_document_types)`
  - Busca semantica por similaridade com fallback SQL.
- `public.has_role(_user_id, _role)`
  - Verificacao de papel para RLS/admin.
- `public.update_updated_at_column()`
  - Trigger helper para `updated_at`.
- `public.check_max_feeds()`
  - Limite de 10 feeds por usuario.

Triggers relevantes:

- `update_documents_updated_at` (`documents`)
- `update_agent_prompts_updated_at` (`agent_prompts`)
- `update_client_metrics_updated_at` (`client_metrics`)
- `update_system_documents_updated_at` (`system_documents`)
- `enforce_max_feeds` (`user_feeds`)

## 6) Politicas RLS (Resumo)

- Contexto por usuario (`auth.uid() = user_id`) em: `documents`, `document_chunks`, `user_feeds`, `articles`, `user_settings`, `user_lesson_progress`, `client_metrics`.
- Acesso admin via `has_role` em: `user_roles`, `client_metrics`.
- Leitura autenticada em: `agent_prompts`, `implementation_tasks`, `lesson_modules`/`lessons` ativos, `system_documents` ativos.
- `internal_api_keys`: acesso apenas para admins (`has_role(..., 'admin')`) e `service_role`.
- Leitura `anon` habilitada para:
  - `client_metrics` (policy de demo)
  - `lesson_modules`/`lessons` ativos
- `service_role` com politicas de gestao em tabelas operacionais especificas.

## 7) Edge Functions e Dependencias

Functions em `supabase/functions`:

- `chat`
- `process-document`
- `delete-document-vectors`
- `extract-document-content`
- `search-trends`
- `market-research-apify-start`
- `market-research-apify-status`
- `sync-implementation`
- `airtable-webhook`
- `calendar-events`
- `pesquisa-callback`
- `pesquisa-status`

Secrets esperados (nomes):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE`
- `APIFY_API_TOKEN`
- `APIFY_ACTOR_ID_INSTAGRAM`
- `APIFY_ACTOR_ID_TIKTOK`
- `APIFY_ACTOR_ID_YOUTUBE`
- `ADDEVENT_API_KEY`
- `ADDEVENT_CALENDAR_ID`

## 8) Provisionamento na Conta Nova (Automatizado)

Script criado:

- `scripts/provision-supabase-new-account.ps1`

Ele executa:

1. Atualiza `supabase/config.toml` com o novo `project_id`.
2. `supabase link` no projeto remoto.
3. `supabase db push` para aplicar todas as migrations.
4. `supabase secrets set --env-file supabase/functions/.env`.
5. Deploy de todas as Edge Functions.

Exemplo de execucao:

```powershell
cd v.1-ide-vscode-remix-of-ai-content-forge
powershell -ExecutionPolicy Bypass -File .\scripts\provision-supabase-new-account.ps1 `
  -ProjectRef "<novo_project_ref>" `
  -DbPassword "<db_password>" `
  -AccessToken "<supabase_access_token>"
```

## 9) Checklist de Validacao Pos-Provisionamento

1. Confirmar que todas as migrations foram aplicadas sem erro (`supabase db push`).
2. Confirmar deploy das 12 Edge Functions.
3. Validar leitura de `agent_prompts` e `system_documents` no runtime do chat.
4. Testar ciclo de documentos:
   - criar documento
   - processar embeddings
   - buscar contexto no `chat`
   - excluir vetores com `delete-document-vectors`
5. Testar pesquisa Instagram via Apify:
   - `market-research-apify-start`
   - `market-research-apify-status`
6. Testar paginas com dependencia de banco:
   - Aulas
   - Implementacao
   - Metricas
   - News Feed
