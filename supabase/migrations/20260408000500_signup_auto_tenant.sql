-- Auto-create tenant/workspace when a new auth user signs up

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_create_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _tenant_slug TEXT;
  _tenant_name TEXT;
  _full_name TEXT;
BEGIN
  _full_name := NULLIF(
    trim(
      COALESCE(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(new.email, '@', 1)
      )
    ),
    ''
  );

  _tenant_slug := 'workspace-' || substring(new.id::text, 1, 8);
  _tenant_name := COALESCE(_full_name, 'Workspace ' || substring(new.id::text, 1, 8));

  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (new.id, _full_name)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(public.user_profiles.full_name, excluded.full_name);

  SELECT tm.tenant_id INTO _tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = new.id
    AND tm.is_active = true
  ORDER BY
    CASE tm.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      ELSE 4
    END,
    tm.created_at ASC
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    INSERT INTO public.tenants (slug, name, created_by)
    VALUES (_tenant_slug, _tenant_name, new.id)
    ON CONFLICT (slug) DO UPDATE SET name = excluded.name
    RETURNING id INTO _tenant_id;

    IF _tenant_id IS NULL THEN
      SELECT id INTO _tenant_id
      FROM public.tenants
      WHERE slug = _tenant_slug
      LIMIT 1;
    END IF;

    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active, created_by)
    VALUES (_tenant_id, new.id, 'owner', true, new.id)
    ON CONFLICT (tenant_id, user_id) DO UPDATE
      SET role = 'owner', is_active = true;
  END IF;

  UPDATE public.user_profiles
  SET default_tenant_id = COALESCE(default_tenant_id, _tenant_id)
  WHERE user_id = new.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_tenant ON auth.users;
CREATE TRIGGER on_auth_user_created_create_tenant
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_create_tenant();
