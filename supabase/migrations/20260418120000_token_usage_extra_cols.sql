-- Add tool_call_count and rag_docs_retrieved columns to token_usage

ALTER TABLE public.token_usage
  ADD COLUMN IF NOT EXISTS tool_call_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rag_docs_retrieved INTEGER NOT NULL DEFAULT 0;
