-- Habilita e padroniza contexto de Documentos para agentes que dependem de base do usu?rio.
BEGIN;

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'icp-architect';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'arquiteta-perfil-icp';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'pillar-strategist';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'matrix-generator';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'marketing-manager';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'scriptwriter';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'copywriter-campanhas';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','calendario','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'expert-social-selling';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','calendario','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'criador-documento-oferta';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'estrategias-sprint-20k';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'arquiteta-workshops';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro','outro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'feedback-conteudo';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'vsl-invisivel';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro','outro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'amanda-ai';

UPDATE public.agent_prompts
SET
  requires_documents = ARRAY['outro','brand-book','pesquisa','icp','roteiro']::text[],
  uses_documents_context = true,
  updated_at = NOW()
WHERE agent_id = 'voz-de-marca';

-- Mant?m explicitamente os agentes sem Documentos por regra de produto.
UPDATE public.agent_prompts
SET
  requires_documents = ARRAY[]::text[],
  uses_documents_context = false,
  updated_at = NOW()
WHERE agent_id IN ('brand-book', 'market-research', 'programa-rivotril');

COMMIT;
