-- Internal API keys managed by admin users
CREATE TABLE IF NOT EXISTS public.internal_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL UNIQUE,
  secret_value TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(trim(key_name)) > 0),
  CHECK (char_length(trim(secret_value)) > 0)
);

ALTER TABLE public.internal_api_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_internal_api_keys_active
  ON public.internal_api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_internal_api_keys_provider
  ON public.internal_api_keys(provider);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_api_keys'
      AND policyname = 'Admin can read internal api keys'
  ) THEN
    CREATE POLICY "Admin can read internal api keys"
      ON public.internal_api_keys
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_api_keys'
      AND policyname = 'Admin can manage internal api keys'
  ) THEN
    CREATE POLICY "Admin can manage internal api keys"
      ON public.internal_api_keys
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'internal_api_keys'
      AND policyname = 'Service role full access internal api keys'
  ) THEN
    CREATE POLICY "Service role full access internal api keys"
      ON public.internal_api_keys
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_internal_api_keys_updated_at ON public.internal_api_keys;
CREATE TRIGGER update_internal_api_keys_updated_at
  BEFORE UPDATE ON public.internal_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
