-- Refactor: add trigger metadata to implementation_tasks for auto-progress
-- and add task_key + auto_detected to implementation_task_checks

-- 1. Add trigger columns to implementation_tasks
ALTER TABLE public.implementation_tasks
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_value TEXT;
-- trigger_type: 'manual' | 'document' | 'lesson' | 'agent' | 'metric'
-- trigger_value: e.g. 'brand-book', 'icp', 'pesquisa', agentId, lessonId, 'weekly_win'

-- 2. Make task_id nullable in checks (tasks may be auto-detected without a DB task row)
ALTER TABLE public.implementation_task_checks
  ALTER COLUMN task_id DROP NOT NULL;

-- 3. Add auto_detected flag
ALTER TABLE public.implementation_task_checks
  ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN NOT NULL DEFAULT false;

-- 4. Drop old unique constraint (task_id was NOT NULL before)
ALTER TABLE public.implementation_task_checks
  DROP CONSTRAINT IF EXISTS implementation_task_checks_tenant_id_user_id_task_id_key;

-- 5. Re-add partial unique index allowing null task_id
DROP INDEX IF EXISTS impl_checks_task_id_unique;
CREATE UNIQUE INDEX impl_checks_task_id_unique
  ON public.implementation_task_checks (tenant_id, user_id, task_id)
  WHERE task_id IS NOT NULL;
