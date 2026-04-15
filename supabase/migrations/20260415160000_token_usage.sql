-- Token usage tracking table
-- Records every AI API call with model, provider, tokens, and cost estimate

CREATE TABLE IF NOT EXISTS public.token_usage (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL,
  model_id     TEXT        NOT NULL,
  provider     TEXT        NOT NULL DEFAULT 'anthropic',
  agent_id     TEXT,
  input_tokens INTEGER     NOT NULL DEFAULT 0,
  output_tokens INTEGER    NOT NULL DEFAULT 0,
  cost_usd     NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by tenant+user and by time
CREATE INDEX IF NOT EXISTS token_usage_tenant_user_idx ON public.token_usage (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS token_usage_created_idx     ON public.token_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS token_usage_model_idx       ON public.token_usage (model_id);

-- RLS
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on token_usage"
  ON public.token_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own token usage"
  ON public.token_usage FOR SELECT
  USING (auth.uid() = user_id);
