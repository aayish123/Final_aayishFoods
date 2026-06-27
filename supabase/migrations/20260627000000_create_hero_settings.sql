-- Create hero_settings singleton table
CREATE TABLE IF NOT EXISTS public.hero_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT,
  primary_button_text TEXT,
  primary_button_url TEXT,
  secondary_button_text TEXT,
  secondary_button_url TEXT,
  hero_image TEXT,
  background_image TEXT,
  badge_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id),
  CONSTRAINT hero_settings_singleton_chk CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Enable RLS
ALTER TABLE public.hero_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active hero settings" ON public.hero_settings 
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins can manage hero settings" ON public.hero_settings 
  FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'edit', 'cms'));

-- Seed default singleton record if not already exists
INSERT INTO public.hero_settings (
  id,
  title,
  subtitle,
  description,
  primary_button_text,
  primary_button_url,
  secondary_button_text,
  secondary_button_url,
  hero_image,
  background_image,
  badge_text
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'The Authentic Taste of Andhra & Telangana',
  'Traditional Recipes. Premium Ingredients. Made with Love.',
  'Handcrafted pickles, traditional sweets, and crispy snacks prepared using age-old family recipes and fresh ingredients.',
  'Shop Now',
  '/menu',
  'Explore Collection',
  '/menu',
  '',
  '',
  '100% Homemade'
) ON CONFLICT (id) DO NOTHING;

-- Trigger function to automatically manage updated_by auditing
CREATE OR REPLACE FUNCTION public.set_hero_settings_audit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_hero_settings_change
  BEFORE INSERT OR UPDATE ON public.hero_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_hero_settings_audit();

-- Trigger to auto-update updated_at column
CREATE OR REPLACE TRIGGER update_hero_settings_updated_at
  BEFORE UPDATE ON public.hero_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
