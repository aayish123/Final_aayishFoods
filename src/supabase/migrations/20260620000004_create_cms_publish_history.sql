-- Migration: Create CMS Publish History Table
-- Date: 2026-06-20

CREATE TABLE IF NOT EXISTS public.cms_publish_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on cms_publish_history
ALTER TABLE public.cms_publish_history ENABLE ROW LEVEL SECURITY;

-- Admins can view and insert publish history safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cms_publish_history' AND policyname = 'Admins can view publish history'
  ) THEN
    CREATE POLICY "Admins can view publish history" 
    ON public.cms_publish_history
    FOR SELECT 
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cms_publish_history' AND policyname = 'Admins can insert publish history'
  ) THEN
    CREATE POLICY "Admins can insert publish history" 
    ON public.cms_publish_history
    FOR INSERT 
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Performance index for retrieval speedups of version listings
CREATE INDEX IF NOT EXISTS idx_cms_publish_history_section_version 
ON public.cms_publish_history(section_id, version DESC);
