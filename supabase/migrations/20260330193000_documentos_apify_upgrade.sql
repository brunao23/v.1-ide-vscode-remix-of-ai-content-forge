-- Add explicit control for document-context-enabled agents
ALTER TABLE public.agent_prompts
ADD COLUMN IF NOT EXISTS uses_documents_context BOOLEAN NOT NULL DEFAULT false;

-- Mark priority agents as document-context-enabled
UPDATE public.agent_prompts
SET uses_documents_context = true
WHERE agent_id IN ('marketing-manager', 'scriptwriter', 'copywriter-campanhas');

-- Add processing state for documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready'
  CHECK (processing_status IN ('pending', 'processing', 'ready', 'error'));

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- System-level documents (fixed rules/guides)
CREATE TABLE IF NOT EXISTS public.system_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  applies_to_agents TEXT[] NOT NULL DEFAULT '{}',
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_documents_active
  ON public.system_documents(is_active);

CREATE INDEX IF NOT EXISTS idx_system_documents_agents
  ON public.system_documents USING GIN(applies_to_agents);

ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_documents'
      AND policyname = 'Authenticated can read system documents'
  ) THEN
    CREATE POLICY "Authenticated can read system documents"
      ON public.system_documents
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_system_documents_updated_at ON public.system_documents;
CREATE TRIGGER update_system_documents_updated_at
  BEFORE UPDATE ON public.system_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
