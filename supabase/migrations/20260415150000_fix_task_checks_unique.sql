-- Fix: replace partial unique index with a proper unique constraint
-- so that Supabase upsert onConflict works correctly.
--
-- PostgreSQL UNIQUE constraints treat NULL as distinct (NULL != NULL),
-- so multiple rows with task_id IS NULL are still allowed.

DROP INDEX IF EXISTS public.impl_checks_task_id_unique;

ALTER TABLE public.implementation_task_checks
  ADD CONSTRAINT impl_checks_tenant_user_task_unique
  UNIQUE (tenant_id, user_id, task_id);
