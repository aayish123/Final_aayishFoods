-- Migration: Create Cart Items Table and Add Search Performance Indexes
-- Date: 2026-06-20

-- 1. Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.food_item_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_item_variant UNIQUE (user_id, food_item_id, variant_id)
);

-- Enable RLS
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Create Policies for cart_items
CREATE POLICY "Users can view their own cart items" ON public.cart_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cart items" ON public.cart_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart items" ON public.cart_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart items" ON public.cart_items
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Create search indexes on food_items
-- GIN indexes for fast tags and search keywords array lookup
CREATE INDEX IF NOT EXISTS idx_food_items_search ON public.food_items USING GIN(search_keywords);
CREATE INDEX IF NOT EXISTS idx_food_items_tags ON public.food_items USING GIN(tags);

-- Standard index for fast exact matching on food_items.name
CREATE INDEX IF NOT EXISTS idx_food_items_name ON public.food_items(name);
