-- Migration: Add Phase 4 Schema Updates
-- Date: 2026-06-20

-- 1. Add is_active flag to profiles for deactivation flows
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Create reports export audit ledger
CREATE TABLE IF NOT EXISTS public.report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on report_exports
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

-- Check policy existence to avoid errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'report_exports' AND policyname = 'Admins can view exports'
  ) THEN
    CREATE POLICY "Admins can view exports"
    ON public.report_exports
    FOR SELECT
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'report_exports' AND policyname = 'Admins can insert exports'
  ) THEN
    CREATE POLICY "Admins can insert exports"
    ON public.report_exports
    FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

-- 4. Create performance indexing strategies
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_date ON public.report_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_settings_category ON public.settings(category);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- Add index on created_at (DESC) for audit logs query performance (most recent first)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
