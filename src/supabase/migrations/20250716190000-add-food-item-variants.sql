-- Migration: Add food_item_variants table for menu quantity/price options

CREATE TABLE public.food_item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id UUID REFERENCES food_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,         -- e.g., '250g', '500g'
  price DECIMAL(10,2) NOT NULL
);

-- Example insert (remove in production):
-- INSERT INTO public.food_item_variants (food_item_id, label, price) VALUES
--   ('<food_item_id>', '250g', 187.00),
--   ('<food_item_id>', '500g', 350.00); 