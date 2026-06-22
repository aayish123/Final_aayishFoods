-- Migration: Performance Tuning Indexes
-- Date: 2026-06-21

-- 1. Index foreign keys and status on reviews table
CREATE INDEX IF NOT EXISTS idx_reviews_food_item_id ON public.reviews(food_item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status) WHERE status = 'pending';

-- 2. Index foreign keys on cart_items table for cascading deletes
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON public.cart_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_food_item_id ON public.cart_items(food_item_id);

-- 3. Index food_item_id on wishlists table for popular wishlist aggregates
CREATE INDEX IF NOT EXISTS idx_wishlists_food_item_id ON public.wishlists(food_item_id);

-- 4. Index active status on coupons table for validation lookups
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON public.coupons(is_active) WHERE is_active = true;

-- 5. Index role and created_at on profiles table for paginated customer listings
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE role = 'user';
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
