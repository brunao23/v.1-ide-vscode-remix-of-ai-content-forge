-- ============================================================
-- Persistencia de chat por usuario/agente com isolamento tenant
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  thinking TEXT,
  thinking_duration DOUBLE PRECISION,
  is_streaming BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant_user_updated
  ON public.chat_conversations(tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant_user_agent
  ON public.chat_conversations(tenant_id, user_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_user_created
  ON public.chat_messages(tenant_id, user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_chat_message_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conversation_tenant_id UUID;
  _conversation_user_id UUID;
BEGIN
  SELECT c.tenant_id, c.user_id
    INTO _conversation_tenant_id, _conversation_user_id
  FROM public.chat_conversations c
  WHERE c.id = NEW.conversation_id;

  IF _conversation_tenant_id IS NULL OR _conversation_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversa nao encontrada para message_id %', NEW.id;
  END IF;

  NEW.tenant_id := _conversation_tenant_id;
  NEW.user_id := _conversation_user_id;
  NEW.created_at := COALESCE(NEW.created_at, NOW());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_chat_message_scope_trigger ON public.chat_messages;
CREATE TRIGGER sync_chat_message_scope_trigger
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_chat_message_scope();

CREATE OR REPLACE FUNCTION public.touch_chat_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conversation_id UUID;
BEGIN
  _conversation_id := COALESCE(NEW.conversation_id, OLD.conversation_id);

  UPDATE public.chat_conversations c
  SET updated_at = NOW()
  WHERE c.id = _conversation_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS touch_chat_conversation_updated_at_trigger ON public.chat_messages;
CREATE TRIGGER touch_chat_conversation_updated_at_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_chat_conversation_updated_at();

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolated chat conversations access" ON public.chat_conversations;
CREATE POLICY "Tenant isolated chat conversations access"
  ON public.chat_conversations
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

DROP POLICY IF EXISTS "Tenant isolated chat messages access" ON public.chat_messages;
CREATE POLICY "Tenant isolated chat messages access"
  ON public.chat_messages
  FOR ALL
  TO authenticated
  USING (
    public.current_user_can_manage_user_row(tenant_id, user_id)
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.tenant_id = chat_messages.tenant_id
        AND c.user_id = chat_messages.user_id
    )
  )
  WITH CHECK (
    public.current_user_can_manage_user_row(tenant_id, user_id)
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.tenant_id = chat_messages.tenant_id
        AND c.user_id = chat_messages.user_id
    )
  );
