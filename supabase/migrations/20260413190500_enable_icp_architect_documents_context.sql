-- Habilita contexto de Documentos para o agente Arquiteto do ICP.
BEGIN;

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'icp-architect';

COMMIT;
