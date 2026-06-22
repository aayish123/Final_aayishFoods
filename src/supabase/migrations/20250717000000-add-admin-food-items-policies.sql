-- Migration: Add admin policies for food_items and food_item_variants tables
-- This allows admins to manage food items and variants through the admin panel

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can insert food items" ON public.food_items;
DROP POLICY IF EXISTS "Admins can update food items" ON public.food_items;
DROP POLICY IF EXISTS "Admins can delete food items" ON public.food_items;
DROP POLICY IF EXISTS "Admins can insert variants" ON public.food_item_variants;
DROP POLICY IF EXISTS "Admins can update variants" ON public.food_item_variants;
DROP POLICY IF EXISTS "Admins can delete variants" ON public.food_item_variants;
DROP POLICY IF EXISTS "Anyone can view variants" ON public.food_item_variants;

-- Add admin policies for food_items table
-- Allow admins to insert new food items
CREATE POLICY "Admins can insert food items" ON public.food_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update food items
CREATE POLICY "Admins can update food items" ON public.food_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to delete food items
CREATE POLICY "Admins can delete food items" ON public.food_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add admin policies for food_item_variants table
-- Allow admins to insert new variants
CREATE POLICY "Admins can insert variants" ON public.food_item_variants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update variants
CREATE POLICY "Admins can update variants" ON public.food_item_variants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to delete variants
CREATE POLICY "Admins can delete variants" ON public.food_item_variants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow public read access to variants (so customers can see them)
CREATE POLICY "Anyone can view variants" ON public.food_item_variants
  FOR SELECT TO authenticated, anon USING (true);

-- Enable RLS on food_item_variants table if not already enabled
ALTER TABLE public.food_item_variants ENABLE ROW LEVEL SECURITY;
