# Pinecone RAG Setup

## 1) Resumo do que foi integrado

Este projeto agora indexa e consulta contexto RAG no Pinecone em:
- `supabase/functions/process-document/index.ts` (ingestao e upsert vetorial)
- `supabase/functions/chat/index.ts` (query vetorial no Pinecone durante o chat)
- `supabase/functions/delete-document-vectors/index.ts` (limpeza de vetores na exclusao)

O modulo de documentos do frontend foi conectado para persistir, indexar e reindexar:
- `src/components/modals/DocumentsModal.tsx`

## 2) Variaveis obrigatorias

Defina no Supabase (Edge Functions secrets):
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `PINECONE_NAMESPACE` (opcional, default: `rag-documents`)
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` (opcional, default: `text-embedding-3-small`)
- demais segredos ja existentes (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc)

Exemplo de comando:

```bash
supabase secrets set PINECONE_API_KEY=... PINECONE_INDEX=... PINECONE_NAMESPACE=rag-documents
```

## 3) Configuracao do indice Pinecone

Recomendacao para embeddings OpenAI `text-embedding-3-small`:
- dimensão: `1536`
- metric: `cosine`

Se usar outro modelo de embedding, ajuste a dimensão do índice e a variavel `OPENAI_EMBEDDING_MODEL`.

## 4) Fluxo de ingestao

1. Usuario cria/edita documento no modal de documentos.
2. Frontend salva na tabela `documents`.
3. Frontend chama `process-document` com:
   - `documentId`
   - `content`
   - `userId`
   - `documentType`
4. Função:
   - quebra em chunks;
   - gera embeddings;
   - grava chunks em `document_chunks` (fallback/auditoria);
   - faz upsert no Pinecone com metadata (`user_id`, `document_id`, `document_type`, `content`).

## 5) Fluxo de consulta no chat

Durante `chat`:
1. identifica ultima mensagem do usuario;
2. gera embedding da pergunta;
3. consulta Pinecone filtrando por:
   - `user_id`
   - `document_type` (quando agente exige tipos especificos via `agent_prompts.requires_documents`);
4. injeta os trechos mais relevantes no system prompt.

Fallback:
- Se Pinecone falhar ou nao retornar resultados, a função tenta busca no Supabase via RPC `search_documents`.

## 6) Exclusao e consistencia

Ao excluir documento no modal:
1. chama `delete-document-vectors` para apagar vetores do Pinecone;
2. remove registro em `documents`.

Isso evita vetores orfaos.

## 7) Observacoes importantes

- Nao versionar `.env` com chaves reais.
- Este projeto agora ignora `.env` e `supabase/functions/.env` por padrao (`.gitignore` atualizado).
- A chave do Pinecone nao foi gravada em arquivos do repositorio.
