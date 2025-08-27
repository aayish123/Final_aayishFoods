-- Migration: Add Google OAuth support and update profiles table
-- This migration adds support for Google authentication users

-- Update profiles table to handle OAuth users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON public.profiles(provider);

-- Update RLS policies to allow OAuth users
-- Allow users to create profiles from OAuth (Google)
CREATE POLICY IF NOT EXISTS "Users can create profile from OAuth" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    (auth.jwt() ->> 'provider' = 'google' AND auth.uid() = id)
  );

-- Allow users to update their own profile (including OAuth users)
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
  );

-- Allow users to view their own profile (including OAuth users)
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
  );

-- Allow admins to view all profiles
CREATE POLICY IF NOT EXISTS "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update all profiles
CREATE POLICY IF NOT EXISTS "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to handle new user creation (including OAuth users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url,
    provider,
    role
  ) VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'provider', 'email'),
    'user'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup (including OAuth)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
