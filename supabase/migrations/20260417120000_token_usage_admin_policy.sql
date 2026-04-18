-- Allow global admins and tenant admins/owners to read token_usage for users in their tenant

CREATE POLICY "Global admins can view all token usage"
  ON public.token_usage
  FOR SELECT
  TO authenticated
  USING (public.is_global_admin(auth.uid()));

CREATE POLICY "Tenant admins can view tenant token usage"
  ON public.token_usage
  FOR SELECT
  TO authenticated
  USING (
    public.has_tenant_role(tenant_id, auth.uid(), ARRAY['owner', 'admin']::public.tenant_role[])
  );
