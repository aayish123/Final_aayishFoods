-- Migration: Add Phase 3 Performance Indexing, Media soft delete, and Inventory Transfer Grouping
-- Date: 2026-06-20

-- 1. Add deleted_at to media_library for soft deletion support
ALTER TABLE public.media_library
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Add transfer_group_id to inventory_movements to link warehouse transfers
ALTER TABLE public.inventory_movements
ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

-- 3. Create additional performance indexes for promotions, assets, and warehouses
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon
ON public.coupon_redemptions(coupon_id);

CREATE INDEX IF NOT EXISTS idx_banner_analytics_banner
ON public.banner_analytics(banner_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_reorder
ON public.warehouse_stock(reorder_level);

CREATE INDEX IF NOT EXISTS idx_media_library_folder
ON public.media_library(folder_name);

CREATE INDEX IF NOT EXISTS idx_media_library_deleted
ON public.media_library(deleted_at);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_transfer
ON public.inventory_movements(transfer_group_id);
