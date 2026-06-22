-- Create database snapshots system tables and functions

-- 1. Create helper for super_admin checking
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
    AND (p.role = 'super_admin' OR r.name = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the snapshot table
CREATE TABLE IF NOT EXISTS public.database_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.database_snapshots ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policy
CREATE POLICY "Super admins can manage database snapshots" ON public.database_snapshots
  FOR ALL USING (public.is_super_admin(auth.uid()));

-- 5. Create database snapshot aggregator function
CREATE OR REPLACE FUNCTION public.create_database_snapshot(snap_type TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
  settings_json JSONB;
  roles_json JSONB;
  permissions_json JSONB;
  role_perms_json JSONB;
  cms_sections_json JSONB;
  cms_history_json JSONB;
  final_data JSONB;
BEGIN
  -- 1. Check and aggregate non-transactional system tables
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO settings_json FROM (SELECT * FROM public.settings) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO roles_json FROM (SELECT * FROM public.roles) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO permissions_json FROM (SELECT * FROM public.permissions) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO role_perms_json FROM (SELECT * FROM public.role_permissions) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO cms_sections_json FROM (SELECT * FROM public.cms_sections) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO cms_history_json FROM (SELECT * FROM public.cms_publish_history) t;

  -- 2. Build complete snapshot structure
  final_data := jsonb_build_object(
    'settings', settings_json,
    'roles', roles_json,
    'permissions', permissions_json,
    'role_permissions', role_perms_json,
    'cms_sections', cms_sections_json,
    'cms_publish_history', cms_history_json
  );

  -- 3. Insert into table
  INSERT INTO public.database_snapshots (snapshot_type, snapshot_data)
  VALUES (snap_type, final_data)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
