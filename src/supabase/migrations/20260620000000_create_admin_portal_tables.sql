-- Migration: Overhaul Aayish Foods Database for Premium Admin Portal (Advanced Enterprise Version)
-- Date: 2026-06-20

-- 1. Create Roles and Permissions Tables for DB-Driven RBAC
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- 'super_admin', 'manager', 'content_manager', 'inventory_manager', 'customer_support'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,      -- 'view', 'create', 'edit', 'delete', 'manage', 'all'
  subject TEXT NOT NULL,     -- 'dashboard', 'products', 'categories', 'orders', 'customers', 'reviews', 'coupons', 'banners', 'inventory', 'reports', 'settings', 'users', 'cms', 'marketing', 'fulfillment', 'zones'
  description TEXT,
  CONSTRAINT unique_action_subject UNIQUE (action, subject)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Alter profiles to support DB-Driven RBAC role mapping
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Safe check and add role column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- Create profiles role sync trigger to update `role` string for backward compatibility
CREATE OR REPLACE FUNCTION sync_profile_role_string()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    NEW.role := (SELECT name FROM public.roles WHERE id = NEW.role_id);
  ELSE
    NEW.role := 'user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_profile_role_id_change
  BEFORE INSERT OR UPDATE OF role_id ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE sync_profile_role_string();

-- 2. Create is_admin() utility helper function supporting dynamic RBAC
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
    AND (p.role = 'admin' OR r.name IN ('super_admin', 'manager', 'content_manager', 'inventory_manager', 'customer_support'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper checking if user has specific permissions
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, p_action TEXT, p_subject TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = user_id;
  
  -- super_admin and legacy 'admin' have full permissions
  IF v_role = 'admin' OR v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.role_permissions rp ON p.role_id = rp.role_id
    JOIN public.permissions perm ON rp.permission_id = perm.id
    WHERE p.id = user_id
    AND (perm.action = 'all' OR perm.action = p_action)
    AND (perm.subject = 'all' OR perm.subject = p_subject)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Delivery Zones Table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pincode TEXT UNIQUE NOT NULL,
  delivery_charge DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  min_order DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Delivery Zones
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active delivery zones" ON public.delivery_zones FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Admins can manage delivery zones" ON public.delivery_zones FOR ALL USING (public.is_admin(auth.uid()));

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[], -- Upgraded to TEXT[] for consistency
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.is_admin(auth.uid()));

-- 5. Alter food_items to support advanced publishing workflows & categories
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS tags TEXT[];
-- publishing states: draft, pending_review, approved, published, archived, hidden
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived', 'hidden'));
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS gallery_images TEXT[];
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT TRUE;
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS search_keywords TEXT[]; -- Added search keywords array

-- Backfill unique slugs for existing food_items to avoid unique conflicts
UPDATE public.food_items SET slug = LOWER(REPLACE(name, ' ', '-')) || '-' || substring(id::text, 1, 8) WHERE slug IS NULL;
ALTER TABLE public.food_items ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_slug_unique UNIQUE (slug);

-- 6. Alter food_item_variants for advanced variant details
ALTER TABLE public.food_item_variants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.food_item_variants ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE public.food_item_variants ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);
ALTER TABLE public.food_item_variants ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE public.food_item_variants ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.food_item_variants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Backfill existing variant rows
UPDATE public.food_item_variants 
SET name = label, weight = label, mrp = price 
WHERE name IS NULL;

-- 7. Reusable Media Library Table (with folder structure)
CREATE TABLE IF NOT EXISTS public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  bucket_name TEXT DEFAULT 'media',
  storage_path TEXT,
  folder_name TEXT DEFAULT 'products', -- e.g. 'products', 'banners', 'cms', 'categories'
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Media Library
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view media" ON public.media_library FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admins can manage media" ON public.media_library FOR ALL USING (public.is_admin(auth.uid()));

-- 8. Product SEO Table (Separated for scalability)
CREATE TABLE IF NOT EXISTS public.product_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID UNIQUE REFERENCES public.food_items(id) ON DELETE CASCADE,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  faq_schema JSONB,
  is_indexable BOOLEAN DEFAULT true,
  last_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on SEO
ALTER TABLE public.product_seo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product seo" ON public.product_seo FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admins can manage product seo" ON public.product_seo FOR ALL USING (public.is_admin(auth.uid()));

-- Automatically update product SEO last_updated_at column
CREATE OR REPLACE FUNCTION update_seo_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_seo_timestamp
  BEFORE UPDATE ON public.product_seo
  FOR EACH ROW EXECUTE PROCEDURE update_seo_timestamp();

-- 9. Reviews Table (with ratings, moderation, replies, correct RLS permissions)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  is_featured BOOLEAN DEFAULT false,
  admin_reply TEXT,
  replied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved, own, or admin reviews" ON public.reviews 
  FOR SELECT USING (status = 'approved' OR user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Authenticated users can submit reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL USING (public.is_admin(auth.uid()));

-- 10. Coupons Table (with category & product limits)
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('flat', 'percentage', 'free_shipping', 'bogo', 'referral', 'birthday', 'category_specific', 'product_specific', 'first_order', 'festival_campaign')),
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  food_item_id UUID REFERENCES public.food_items(id) ON DELETE SET NULL,
  campaign_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view active coupons" ON public.coupons FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.is_admin(auth.uid()));

-- 10.5. Coupon Redemptions Ledger
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Coupon Redemptions
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own redemptions" ON public.coupon_redemptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view redemptions" ON public.coupon_redemptions FOR SELECT USING (public.is_admin(auth.uid()));

-- Function to increment coupon usage count upon redemption
CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.coupons
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_increment_coupon_usage
  AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE PROCEDURE increment_coupon_usage();

-- 11. Flexible Banners Table
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  page TEXT NOT NULL,          -- e.g. 'home', 'menu', 'product', 'offers'
  section TEXT NOT NULL,       -- e.g. 'hero', 'top', 'sidebar', 'popup'
  device_type TEXT NOT NULL CHECK (device_type IN ('desktop', 'mobile', 'all')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Admins can manage banners" ON public.banners FOR ALL USING (public.is_admin(auth.uid()));

-- 12. Banner Click & View Analytics Table (Compliant with Privacy Rules)
CREATE TABLE IF NOT EXISTS public.banner_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id UUID REFERENCES public.banners(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_type TEXT,            -- 'desktop', 'mobile'
  country TEXT,                -- Privacy-safe geographic tracking instead of raw IP
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Banner Analytics
ALTER TABLE public.banner_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert banner analytic events" ON public.banner_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view banner analytics" ON public.banner_analytics FOR SELECT USING (public.is_admin(auth.uid()));

-- 13. Warehouses and Warehouse Stock (with Reservations)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.food_item_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0, -- total physical stock in warehouse
  reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  available_stock INTEGER GENERATED ALWAYS AS (quantity - reserved_stock) STORED,
  reorder_level INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_warehouse_variant UNIQUE (warehouse_id, variant_id),
  CONSTRAINT quantity_check CHECK (quantity >= 0)
);

-- Enable RLS on Warehouse structures
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage warehouses" ON public.warehouses FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage warehouse stock" ON public.warehouse_stock FOR ALL USING (public.is_admin(auth.uid()));

-- 14. Inventory Movements Table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.food_item_variants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'transfer', 'audit')),
  quantity INTEGER NOT NULL, -- positive for incoming, negative for outgoing
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on inventory movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage inventory movements" ON public.inventory_movements FOR ALL USING (public.is_admin(auth.uid()));

-- 15. Wishlists Table
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_food_item UNIQUE (user_id, food_item_id)
);

-- Enable RLS on Wishlists
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own wishlist" ON public.wishlists FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins can view wishlists" ON public.wishlists FOR SELECT USING (public.is_admin(auth.uid()));

-- 16. Order Refunds Table
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'failed')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Order Refunds
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own refunds" ON public.order_refunds 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_refunds.order_id 
      AND orders.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins can manage refunds" ON public.order_refunds FOR ALL USING (public.is_admin(auth.uid()));

-- 17. Notification Center Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order', 'coupon', 'stock', 'review', 'system')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins can create notifications" ON public.notifications FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- 18. Order Notes Table
CREATE TABLE IF NOT EXISTS public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Order Notes
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage order notes" ON public.order_notes FOR ALL USING (public.is_admin(auth.uid()));

-- 19. Order Status History Tracker
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Enable RLS on Status history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage status histories" ON public.order_status_history FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can view their own order status history" ON public.order_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_status_history.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- 20. Customer Activity Log Table
CREATE TABLE IF NOT EXISTS public.customer_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'order_placed', 'review_submitted', 'coupon_used', 'wishlist_added', 'cart_activity', 'profile_updated')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Customer Activity
ALTER TABLE public.customer_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view customer activities" ON public.customer_activity FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can view their own activities" ON public.customer_activity FOR SELECT USING (customer_id = auth.uid());

-- 21. Audit Logs Table (For security logging & activity feeds)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,         -- 'insert', 'update', 'delete', 'login', etc.
  entity_type TEXT NOT NULL,    -- 'product', 'order', 'coupon', 'inventory', 'user', 'settings', 'seo', 'cms', 'marketing', 'fulfillment', 'zones'
  entity_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin(auth.uid()));

-- 22. Key-Value Settings Table (with Category field)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('store', 'seo', 'payment', 'shipping', 'sms', 'email', 'tax', 'social', 'system')),
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON public.settings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.is_admin(auth.uid()));

-- 23. Versioned Homepage CMS Sections
CREATE TABLE IF NOT EXISTS public.cms_sections (
  id TEXT PRIMARY KEY,          -- 'hero', 'about', 'testimonials', 'faq', 'trust_badges', 'footer'
  version INTEGER DEFAULT 1,
  published_version INTEGER DEFAULT 0,
  draft_content JSONB,
  published_content JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on CMS
ALTER TABLE public.cms_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published CMS content" ON public.cms_sections FOR SELECT TO authenticated, anon USING (published_content IS NOT NULL);
CREATE POLICY "Admins can manage CMS content" ON public.cms_sections FOR ALL USING (public.is_admin(auth.uid()));

-- 24. Reports Cache/Snapshotting Tables (For heavy aggregation speedups)
CREATE TABLE IF NOT EXISTS public.report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily_sales', 'weekly_sales', 'monthly_sales', 'inventory_valuation', 'coupon_performance')),
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_snapshot_type_date UNIQUE (snapshot_type, snapshot_date)
);

-- Enable RLS on Snapshots
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view snapshots" ON public.report_snapshots FOR SELECT USING (public.is_admin(auth.uid()));


-- ==========================================
-- TRIGGERS & SYNC FUNCTIONS FOR STOCK
-- ==========================================

-- Function: Auto-sync food_item_variants.stock from aggregate warehouse_stock
CREATE OR REPLACE FUNCTION sync_variant_stock_from_warehouses()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.food_item_variants
  SET stock = (
    SELECT COALESCE(SUM(available_stock), 0)
    FROM public.warehouse_stock
    WHERE variant_id = COALESCE(NEW.variant_id, OLD.variant_id)
  )
  WHERE id = COALESCE(NEW.variant_id, OLD.variant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_warehouse_stock_change
  AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_stock
  FOR EACH ROW EXECUTE PROCEDURE sync_variant_stock_from_warehouses();

-- Function: Auto-sync food_items.in_stock based on variants aggregate stock availability
CREATE OR REPLACE FUNCTION sync_product_instock_from_variants()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_total_stock INTEGER;
BEGIN
  v_product_id := COALESCE(NEW.food_item_id, OLD.food_item_id);

  -- Sum up stock of all active variants for the product
  SELECT COALESCE(SUM(stock), 0)
  INTO v_total_stock
  FROM public.food_item_variants
  WHERE food_item_id = v_product_id AND status = 'active';

  -- Update in_stock flag on food_items
  UPDATE public.food_items
  SET in_stock = (v_total_stock > 0)
  WHERE id = v_product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_variant_stock_change
  AFTER INSERT OR UPDATE OR DELETE ON public.food_item_variants
  FOR EACH ROW EXECUTE PROCEDURE public.sync_product_instock_from_variants();


-- ==========================================
-- DATABASE PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_food_items_slug ON public.food_items(slug);
CREATE INDEX IF NOT EXISTS idx_food_items_category ON public.food_items(category_id);
CREATE INDEX IF NOT EXISTS idx_food_items_status ON public.food_items(status);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

CREATE INDEX IF NOT EXISTS idx_variant_stock_variant ON public.warehouse_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON public.inventory_movements(variant_id);


-- ==========================================
-- REALTIME ENABLEMENT FOR REALTIME REFRESH
-- ==========================================
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.food_items REPLICA IDENTITY FULL;
ALTER TABLE public.food_item_variants REPLICA IDENTITY FULL;
ALTER TABLE public.product_seo REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;
ALTER TABLE public.coupons REPLICA IDENTITY FULL;
ALTER TABLE public.banners REPLICA IDENTITY FULL;
ALTER TABLE public.warehouse_stock REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.cms_sections REPLICA IDENTITY FULL;

-- Safe Realtime Publication Seeding logic to prevent duplicate registration crashes
DO $$
BEGIN
  -- Add categories to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'categories'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.categories;
  END IF;

  -- Add product_seo to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'product_seo'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.product_seo;
  END IF;

  -- Add reviews to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'reviews'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.reviews;
  END IF;

  -- Add coupons to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'coupons'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.coupons;
  END IF;

  -- Add banners to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'banners'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.banners;
  END IF;

  -- Add settings to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'settings'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.settings;
  END IF;

  -- Add cms_sections to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'cms_sections'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.cms_sections;
  END IF;

  -- Add food_item_variants to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'food_item_variants'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.food_item_variants;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Catch publication reference missing errors in testing scopes
END $$;

-- Insert default main warehouse
INSERT INTO public.warehouses (name, location) 
VALUES ('Main Warehouse', 'Aayish Foods Headquarters')
ON CONFLICT (name) DO NOTHING;

-- Seed Basic Roles
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Full access to all modules and configurations'),
  ('manager', 'Access to operational management excluding raw store settings'),
  ('content_manager', 'Manage products, categories, reviews, banners, and CMS content'),
  ('inventory_manager', 'Manage warehouses and product variant stock levels'),
  ('customer_support', 'View orders, update delivery tracking, write order notes, moderate reviews')
ON CONFLICT (name) DO NOTHING;
