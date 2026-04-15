-- ============================================================
-- Multi-tenant foundation + security hardening (RLS-first)
-- ============================================================

-- 1) Tenant model
DO $$
BEGIN
  CREATE TYPE public.tenant_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  default_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id
  ON public.tenant_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id
  ON public.tenant_memberships(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_role
  ON public.tenant_memberships(role);

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_memberships_updated_at ON public.tenant_memberships;
CREATE TRIGGER update_tenant_memberships_updated_at
  BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Helper functions for RLS + backend checks
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.has_role(_user_id, 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = _tenant_id
        AND tm.user_id = _user_id
        AND tm.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(
  _tenant_id UUID,
  _user_id UUID,
  _roles public.tenant_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_global_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = _tenant_id
        AND tm.user_id = _user_id
        AND tm.is_active = true
        AND tm.role = ANY(_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_default_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH preferred AS (
    SELECT up.default_tenant_id AS tenant_id
    FROM public.user_profiles up
    WHERE up.user_id = _user_id
      AND up.default_tenant_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.tenant_memberships tm
        WHERE tm.user_id = _user_id
          AND tm.tenant_id = up.default_tenant_id
          AND tm.is_active = true
      )
    LIMIT 1
  ),
  first_membership AS (
    SELECT tm.tenant_id
    FROM public.tenant_memberships tm
    WHERE tm.user_id = _user_id
      AND tm.is_active = true
    ORDER BY
      CASE tm.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 3
        ELSE 4
      END,
      tm.created_at ASC
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT tenant_id FROM preferred),
    (SELECT tenant_id FROM first_membership)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_default_tenant_id(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_tenant(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_tenant_member(_tenant_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_user_row(_tenant_id UUID, _row_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      auth.uid() = _row_user_id
      OR public.has_tenant_role(
        _tenant_id,
        auth.uid(),
        ARRAY['owner', 'admin']::public.tenant_role[]
      )
    );
$$;

-- 3) Seed/Backfill tenant memberships for existing real users
INSERT INTO public.user_profiles (user_id, full_name)
SELECT
  u.id,
  NULLIF(
    COALESCE(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      split_part(u.email, '@', 1)
    ),
    ''
  )
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

CREATE TEMP TABLE _new_tenant_map (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO _new_tenant_map (user_id, tenant_id)
SELECT
  u.id,
  gen_random_uuid()
FROM auth.users u
LEFT JOIN public.tenant_memberships tm
  ON tm.user_id = u.id
  AND tm.is_active = true
WHERE tm.user_id IS NULL;

INSERT INTO public.tenants (id, slug, name, created_by)
SELECT
  m.tenant_id,
  'workspace-' || substring(m.user_id::text, 1, 8),
  COALESCE(NULLIF(split_part(u.email, '@', 1), ''), 'Workspace ' || substring(m.user_id::text, 1, 8)),
  m.user_id
FROM _new_tenant_map m
JOIN auth.users u ON u.id = m.user_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active, created_by)
SELECT
  m.tenant_id,
  m.user_id,
  'owner'::public.tenant_role,
  true,
  m.user_id
FROM _new_tenant_map m
ON CONFLICT (tenant_id, user_id) DO NOTHING;

UPDATE public.user_profiles up
SET default_tenant_id = m.tenant_id
FROM _new_tenant_map m
WHERE up.user_id = m.user_id
  AND up.default_tenant_id IS NULL;

UPDATE public.user_profiles up
SET default_tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (tm.user_id)
    tm.user_id,
    tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.is_active = true
  ORDER BY
    tm.user_id,
    CASE tm.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      ELSE 4
    END,
    tm.created_at
) sub
WHERE up.user_id = sub.user_id
  AND up.default_tenant_id IS NULL;

INSERT INTO public.tenants (id, slug, name, is_active)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'legacy-unassigned',
  'Legacy Unassigned',
  false
)
ON CONFLICT (slug) DO NOTHING;

-- 4) Add tenant_id to user-scoped tables + backfill
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.client_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.user_feeds ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.user_lesson_progress ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.weekly_wins_submissions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.monthly_data_submissions ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.new_deal_submissions ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE public.documents d
SET tenant_id = COALESCE(
  public.get_default_tenant_id(d.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE d.tenant_id IS NULL;

UPDATE public.document_chunks dc
SET tenant_id = d.tenant_id
FROM public.documents d
WHERE dc.document_id = d.id
  AND dc.tenant_id IS NULL;

UPDATE public.document_chunks dc
SET tenant_id = COALESCE(
  public.get_default_tenant_id(dc.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE dc.tenant_id IS NULL;

UPDATE public.client_metrics cm
SET tenant_id = COALESCE(
  public.get_default_tenant_id(cm.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE cm.tenant_id IS NULL;

UPDATE public.user_feeds uf
SET tenant_id = COALESCE(
  public.get_default_tenant_id(uf.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE uf.tenant_id IS NULL;

UPDATE public.articles a
SET tenant_id = COALESCE(
  public.get_default_tenant_id(a.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE a.tenant_id IS NULL;

UPDATE public.user_settings us
SET tenant_id = COALESCE(
  public.get_default_tenant_id(us.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE us.tenant_id IS NULL;

UPDATE public.user_lesson_progress ulp
SET tenant_id = COALESCE(
  public.get_default_tenant_id(ulp.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE ulp.tenant_id IS NULL;

UPDATE public.weekly_wins_submissions w
SET tenant_id = COALESCE(
  public.get_default_tenant_id(w.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE w.tenant_id IS NULL;

UPDATE public.monthly_data_submissions m
SET tenant_id = COALESCE(
  public.get_default_tenant_id(m.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE m.tenant_id IS NULL;

UPDATE public.new_deal_submissions nd
SET tenant_id = COALESCE(
  public.get_default_tenant_id(nd.user_id),
  '00000000-0000-4000-8000-000000000001'::uuid
)
WHERE nd.tenant_id IS NULL;

ALTER TABLE public.documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.document_chunks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.client_metrics ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_feeds ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.articles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_lesson_progress ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.weekly_wins_submissions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.monthly_data_submissions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.new_deal_submissions ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_chunks_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.document_chunks
      ADD CONSTRAINT document_chunks_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_metrics_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.client_metrics
      ADD CONSTRAINT client_metrics_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_feeds_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.user_feeds
      ADD CONSTRAINT user_feeds_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'articles_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_lesson_progress_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.user_lesson_progress
      ADD CONSTRAINT user_lesson_progress_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_wins_submissions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.weekly_wins_submissions
      ADD CONSTRAINT weekly_wins_submissions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_data_submissions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.monthly_data_submissions
      ADD CONSTRAINT monthly_data_submissions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'new_deal_submissions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.new_deal_submissions
      ADD CONSTRAINT new_deal_submissions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_user
  ON public.documents(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_user
  ON public.document_chunks(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_client_metrics_tenant_user_period
  ON public.client_metrics(tenant_id, user_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_user_feeds_tenant_user
  ON public.user_feeds(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_articles_tenant_user
  ON public.articles(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_tenant_user
  ON public.user_settings(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_tenant_user
  ON public.user_lesson_progress(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_wins_tenant_user
  ON public.weekly_wins_submissions(tenant_id, user_id, reference_date DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_data_tenant_user
  ON public.monthly_data_submissions(tenant_id, user_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_new_deals_tenant_user
  ON public.new_deal_submissions(tenant_id, user_id, deal_date DESC);

ALTER TABLE public.client_metrics
  DROP CONSTRAINT IF EXISTS client_metrics_user_id_period_month_period_year_key;

ALTER TABLE public.client_metrics
  ADD CONSTRAINT client_metrics_tenant_user_period_key
  UNIQUE (tenant_id, user_id, period_month, period_year);

ALTER TABLE public.monthly_data_submissions
  DROP CONSTRAINT IF EXISTS monthly_data_submissions_user_id_period_month_period_year_key;

ALTER TABLE public.monthly_data_submissions
  ADD CONSTRAINT monthly_data_submissions_tenant_user_period_key
  UNIQUE (tenant_id, user_id, period_month, period_year);

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_user_id_key;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_tenant_user_key
  UNIQUE (tenant_id, user_id);

ALTER TABLE public.user_lesson_progress
  DROP CONSTRAINT IF EXISTS user_lesson_progress_user_id_lesson_id_key;

ALTER TABLE public.user_lesson_progress
  ADD CONSTRAINT user_lesson_progress_tenant_user_lesson_key
  UNIQUE (tenant_id, user_id, lesson_id);

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_user_id_link_key;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_tenant_user_link_key
  UNIQUE (tenant_id, user_id, link);

-- 5) Strengthen feed limit trigger (per user + tenant)
CREATE OR REPLACE FUNCTION public.check_max_feeds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.user_feeds uf
    WHERE uf.user_id = NEW.user_id
      AND uf.tenant_id = NEW.tenant_id
  ) >= 10 THEN
    RAISE EXCEPTION 'Maximo de 10 feeds por usuario e tenant atingido';
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Rewrite broad/open policies (tenant-safe)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants read" ON public.tenants;
DROP POLICY IF EXISTS "Tenants manage" ON public.tenants;
DROP POLICY IF EXISTS "Tenant memberships read" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Tenant memberships manage" ON public.tenant_memberships;
DROP POLICY IF EXISTS "User profiles self read" ON public.user_profiles;
DROP POLICY IF EXISTS "User profiles manage" ON public.user_profiles;

CREATE POLICY "Tenants read"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = tenants.id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

CREATE POLICY "Tenants manage"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

CREATE POLICY "Tenant memberships read"
  ON public.tenant_memberships
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_tenant_role(
      tenant_id,
      auth.uid(),
      ARRAY['owner', 'admin']::public.tenant_role[]
    )
  );

CREATE POLICY "Tenant memberships manage"
  ON public.tenant_memberships
  FOR ALL
  TO authenticated
  USING (
    public.has_tenant_role(
      tenant_id,
      auth.uid(),
      ARRAY['owner', 'admin']::public.tenant_role[]
    )
  )
  WITH CHECK (
    public.has_tenant_role(
      tenant_id,
      auth.uid(),
      ARRAY['owner', 'admin']::public.tenant_role[]
    )
  );

CREATE POLICY "User profiles read"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_global_admin(auth.uid())
  );

CREATE POLICY "User profiles manage"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_global_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_global_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can manage own chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can view own metrics" ON public.client_metrics;
DROP POLICY IF EXISTS "Users can insert own metrics" ON public.client_metrics;
DROP POLICY IF EXISTS "Users can update own metrics" ON public.client_metrics;
DROP POLICY IF EXISTS "Admin can view all metrics" ON public.client_metrics;
DROP POLICY IF EXISTS "Admin can manage all metrics" ON public.client_metrics;
DROP POLICY IF EXISTS "Users manage own feeds" ON public.user_feeds;
DROP POLICY IF EXISTS "Users view own articles" ON public.articles;
DROP POLICY IF EXISTS "Users insert own articles" ON public.articles;
DROP POLICY IF EXISTS "Users delete own articles" ON public.articles;
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users manage own progress" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "Users manage own weekly wins" ON public.weekly_wins_submissions;
DROP POLICY IF EXISTS "Users manage own monthly data" ON public.monthly_data_submissions;
DROP POLICY IF EXISTS "Users manage own new deals" ON public.new_deal_submissions;

CREATE POLICY "Tenant isolated documents access"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated chunks access"
  ON public.document_chunks
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated metrics access"
  ON public.client_metrics
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated weekly wins access"
  ON public.weekly_wins_submissions
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated monthly data access"
  ON public.monthly_data_submissions
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated new deals access"
  ON public.new_deal_submissions
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated feeds access"
  ON public.user_feeds
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated articles access"
  ON public.articles
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated settings access"
  ON public.user_settings
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

CREATE POLICY "Tenant isolated lesson progress access"
  ON public.user_lesson_progress
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

-- Harden lessons/modules policies (remove broad write)
DROP POLICY IF EXISTS "Authenticated can insert modules" ON public.lesson_modules;
DROP POLICY IF EXISTS "Authenticated can update modules" ON public.lesson_modules;
DROP POLICY IF EXISTS "Authenticated can delete modules" ON public.lesson_modules;
DROP POLICY IF EXISTS "Authenticated can insert lessons" ON public.lessons;
DROP POLICY IF EXISTS "Authenticated can update lessons" ON public.lessons;
DROP POLICY IF EXISTS "Authenticated can delete lessons" ON public.lessons;

DROP POLICY IF EXISTS "Authenticated can view modules" ON public.lesson_modules;
DROP POLICY IF EXISTS "Authenticated can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Anon can view active modules" ON public.lesson_modules;
DROP POLICY IF EXISTS "Anon can view active lessons" ON public.lessons;

CREATE POLICY "Public can read active modules"
  ON public.lesson_modules
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Public can read active lessons"
  ON public.lessons
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admin can manage modules"
  ON public.lesson_modules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage lessons"
  ON public.lessons
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can manage prompts/system docs
DROP POLICY IF EXISTS "Admin can manage agent prompts" ON public.agent_prompts;
CREATE POLICY "Admin can manage agent prompts"
  ON public.agent_prompts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin can manage system documents" ON public.system_documents;
CREATE POLICY "Admin can manage system documents"
  ON public.system_documents
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) Update vector search RPC for tenant-aware filtering
DROP FUNCTION IF EXISTS public.search_documents(vector(1536), integer, uuid, text[]);

CREATE OR REPLACE FUNCTION public.search_documents(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_user_id UUID DEFAULT NULL,
  filter_document_types TEXT[] DEFAULT NULL,
  filter_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE
    (filter_user_id IS NULL OR dc.user_id = filter_user_id)
    AND (filter_tenant_id IS NULL OR d.tenant_id = filter_tenant_id)
    AND (filter_document_types IS NULL OR d.type = ANY(filter_document_types))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

