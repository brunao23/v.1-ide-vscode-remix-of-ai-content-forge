-- Registro de checks de tarefas de implementação por usuário/tenant
CREATE TABLE IF NOT EXISTS public.implementation_task_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.implementation_tasks(id) ON DELETE CASCADE,
  is_checked BOOLEAN NOT NULL DEFAULT true,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, task_id)
);

ALTER TABLE public.implementation_task_checks
  ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_implementation_task_checks_tenant_user
  ON public.implementation_task_checks(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_implementation_task_checks_task
  ON public.implementation_task_checks(task_id);

CREATE INDEX IF NOT EXISTS idx_implementation_task_checks_checked_at
  ON public.implementation_task_checks(checked_at DESC);

ALTER TABLE public.implementation_task_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolated implementation task checks access" ON public.implementation_task_checks;
CREATE POLICY "Tenant isolated implementation task checks access"
  ON public.implementation_task_checks
  FOR ALL
  TO authenticated
  USING (public.current_user_can_manage_user_row(tenant_id, user_id))
  WITH CHECK (public.current_user_can_manage_user_row(tenant_id, user_id));

DROP TRIGGER IF EXISTS update_implementation_task_checks_updated_at ON public.implementation_task_checks;
CREATE TRIGGER update_implementation_task_checks_updated_at
  BEFORE UPDATE ON public.implementation_task_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
