-- Ensure tenant_id defaults to current authenticated tenant for client-side inserts

ALTER TABLE public.documents
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.document_chunks
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.client_metrics
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.user_feeds
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.articles
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.user_settings
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.user_lesson_progress
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.weekly_wins_submissions
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.monthly_data_submissions
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

ALTER TABLE public.new_deal_submissions
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
