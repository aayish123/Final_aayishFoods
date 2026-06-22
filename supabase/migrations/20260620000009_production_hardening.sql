-- Migration: Production Hardening, Checkout RPC, Idempotency Ledger, Price Snapshotting, and RLS Permissions overhaul
-- Date: 2026-06-20

-- ==========================================
-- 1. SCHEMA MODIFICATIONS
-- ==========================================

-- Expand status check constraints on orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded', 'payment_review'));

-- Add payment_review_reason column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_review_reason TEXT;

-- Add snapshot columns to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_name_snapshot TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);

-- Create checkout idempotency requests table
CREATE TABLE IF NOT EXISTS public.checkout_requests (
    idempotency_key UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on idempotency ledger
ALTER TABLE public.checkout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own checkout requests" ON public.checkout_requests;
CREATE POLICY "Users manage own checkout requests" ON public.checkout_requests
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ==========================================
-- 2. SECURITY DEFINER SEARCH_PATH HARDENING
-- ==========================================

ALTER FUNCTION public.is_admin(UUID) SET search_path = public;
ALTER FUNCTION public.is_super_admin(UUID) SET search_path = public;
ALTER FUNCTION public.has_permission(UUID, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.sync_profile_role_string() SET search_path = public;
ALTER FUNCTION public.update_seo_timestamp() SET search_path = public;
ALTER FUNCTION public.increment_coupon_usage() SET search_path = public;
ALTER FUNCTION public.sync_variant_stock_from_warehouses() SET search_path = public;
ALTER FUNCTION public.sync_product_instock_from_variants() SET search_path = public;


-- ==========================================
-- 3. PERMISSION-BASED RLS Overhaul
-- ==========================================

-- Repair addresses view to respect base table RLS
CREATE OR REPLACE VIEW public.customer_addresses WITH (security_invoker = true) AS 
SELECT * FROM public.addresses;

-- Orders policies
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own pending orders" ON public.orders;

CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'orders'));

CREATE POLICY "Admins can update all orders" ON public.orders
  FOR UPDATE USING (public.has_permission(auth.uid(), 'edit', 'orders')) WITH CHECK (public.has_permission(auth.uid(), 'edit', 'orders'));

-- Order items policies
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create their order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

CREATE POLICY "Users can view their order items" ON public.order_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Users can create their order items" ON public.order_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'orders'));

-- Customer notes policies
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage customer notes" ON public.customer_notes;
CREATE POLICY "Admins can manage customer notes" ON public.customer_notes
  FOR ALL USING (public.has_permission(auth.uid(), 'view', 'customers')) WITH CHECK (public.has_permission(auth.uid(), 'edit', 'customers'));

-- Audit logs policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'users'));

CREATE POLICY "Admins can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit', 'users'));

-- Customer activity policies
DROP POLICY IF EXISTS "Admins can view customer activities" ON public.customer_activity;
DROP POLICY IF EXISTS "Users can view their own activities" ON public.customer_activity;
DROP POLICY IF EXISTS "Anyone can insert customer activity" ON public.customer_activity;

CREATE POLICY "Admins can view customer activities" ON public.customer_activity
  FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'customers'));

CREATE POLICY "Users can view their own activities" ON public.customer_activity
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Anyone can insert customer activity" ON public.customer_activity
  FOR INSERT WITH CHECK (auth.uid() = customer_id OR auth.uid() IS NULL);

-- Profiles policies update
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'customers'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_permission(auth.uid(), 'edit', 'customers')) WITH CHECK (public.has_permission(auth.uid(), 'edit', 'customers'));

-- Food items & variants updates
DROP POLICY IF EXISTS "Admins can insert food items" ON public.food_items;
DROP POLICY IF EXISTS "Admins can update food items" ON public.food_items;
DROP POLICY IF EXISTS "Admins can delete food items" ON public.food_items;

CREATE POLICY "Admins can insert food items" ON public.food_items
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'create', 'products'));

CREATE POLICY "Admins can update food items" ON public.food_items
  FOR UPDATE USING (public.has_permission(auth.uid(), 'edit', 'products'));

CREATE POLICY "Admins can delete food items" ON public.food_items
  FOR DELETE USING (public.has_permission(auth.uid(), 'delete', 'products'));

DROP POLICY IF EXISTS "Admins can insert variants" ON public.food_item_variants;
DROP POLICY IF EXISTS "Admins can update variants" ON public.food_item_variants;
DROP POLICY IF EXISTS "Admins can delete variants" ON public.food_item_variants;

CREATE POLICY "Admins can insert variants" ON public.food_item_variants
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'create', 'products'));

CREATE POLICY "Admins can update variants" ON public.food_item_variants
  FOR UPDATE USING (public.has_permission(auth.uid(), 'edit', 'products'));

CREATE POLICY "Admins can delete variants" ON public.food_item_variants
  FOR DELETE USING (public.has_permission(auth.uid(), 'delete', 'products'));

-- Coupons view policy update to support anonymous users
DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON public.coupons;
CREATE POLICY "Anyone can view active coupons" ON public.coupons
  FOR SELECT TO authenticated, anon USING (is_active = true);


-- ==========================================
-- 4. SNAPSHOT EXECUTION HARDENING
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_database_snapshot(snap_type TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  settings_json JSONB;
  roles_json JSONB;
  permissions_json JSONB;
  role_perms_json JSONB;
  cms_sections_json JSONB;
  cms_history_json JSONB;
  final_data JSONB;
BEGIN
  -- Strict permission guard: Require super_admin or service_role
  IF NOT public.is_super_admin(auth.uid()) AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access Denied: Only super administrators can trigger database snapshots.';
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO settings_json FROM (SELECT * FROM public.settings) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO roles_json FROM (SELECT * FROM public.roles) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO permissions_json FROM (SELECT * FROM public.permissions) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO role_perms_json FROM (SELECT * FROM public.role_permissions) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO cms_sections_json FROM (SELECT * FROM public.cms_sections) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO cms_history_json FROM (SELECT * FROM public.cms_publish_history) t;

  final_data := jsonb_build_object(
    'settings', settings_json,
    'roles', roles_json,
    'permissions', permissions_json,
    'role_permissions', role_perms_json,
    'cms_sections', cms_sections_json,
    'cms_publish_history', cms_history_json
  );

  INSERT INTO public.database_snapshots (snapshot_type, snapshot_data)
  VALUES (snap_type, final_data)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


-- ==========================================
-- 5. DATABASE-LEVEL COUPON VERIFICATION TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION public.validate_coupon_redemption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_user_uses INT;
  v_order_amount DECIMAL(10,2);
BEGIN
  SELECT * INTO v_coupon FROM public.coupons WHERE id = NEW.coupon_id;
  
  IF v_coupon IS NULL THEN
    RAISE EXCEPTION 'Coupon does not exist';
  END IF;

  IF NOT v_coupon.is_active THEN
    RAISE EXCEPTION 'Coupon code is inactive';
  END IF;
  
  IF v_coupon.end_date IS NOT NULL AND v_coupon.end_date < now() THEN
    RAISE EXCEPTION 'Coupon code has expired';
  END IF;

  IF v_coupon.start_date IS NOT NULL AND v_coupon.start_date > now() THEN
    RAISE EXCEPTION 'Coupon campaign is not active yet';
  END IF;

  -- Validate usage limit
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
    RAISE EXCEPTION 'Coupon usage limit has been reached';
  END IF;

  -- Validate per-user limits
  SELECT COUNT(*) INTO v_user_uses 
  FROM public.coupon_redemptions 
  WHERE coupon_id = NEW.coupon_id AND user_id = NEW.user_id;
  
  IF v_coupon.max_uses_per_user IS NOT NULL AND v_user_uses >= v_coupon.max_uses_per_user THEN
    RAISE EXCEPTION 'You have already reached the maximum uses for this coupon';
  END IF;

  -- Verify minimum order value is met on the order total
  SELECT total_amount INTO v_order_amount FROM public.orders WHERE id = NEW.order_id;
  IF v_coupon.min_order_amount IS NOT NULL AND (v_order_amount + NEW.discount_amount) < v_coupon.min_order_amount THEN
    RAISE EXCEPTION 'Order amount is below the minimum required spend of ₹%', v_coupon.min_order_amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_coupon_redemption ON public.coupon_redemptions;
CREATE TRIGGER trigger_validate_coupon_redemption
  BEFORE INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE PROCEDURE public.validate_coupon_redemption();


-- ==========================================
-- 6. CHECKOUT TRANSACTIONAL RPC WITH PRICE SNAPSHOTTING & IDEMPOTENCY LOCKS
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_address_id UUID,
  p_coupon_code TEXT,
  p_items JSONB,
  p_payment_method TEXT,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
  v_address_pincode TEXT;
  v_delivery_zone_fee DECIMAL(10,2);
  v_default_delivery_fee DECIMAL(10,2);
  v_shipping_fee DECIMAL(10,2) := 0.00;
  v_item RECORD;
  v_subtotal DECIMAL(10,2) := 0.00;
  v_discount DECIMAL(10,2) := 0.00;
  v_final_amount DECIMAL(10,2);
  v_coupon RECORD;
  v_coupon_user_count INT;
  v_variant RECORD;
  v_item_price DECIMAL(10,2);
  v_order_status TEXT;
  v_payment_status TEXT;
  v_existing_order_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Idempotency concurrency transaction locking check
  INSERT INTO public.checkout_requests (idempotency_key, user_id, expires_at)
  VALUES (p_idempotency_key, v_user_id, now() + interval '24 hours')
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- If key already exists, return existing order information
  IF NOT FOUND THEN
    SELECT order_id INTO v_existing_order_id FROM public.checkout_requests WHERE idempotency_key = p_idempotency_key;
    IF v_existing_order_id IS NOT NULL THEN
      RETURN (
        SELECT jsonb_build_object(
          'order_id', id,
          'total_amount', total_amount,
          'status', status,
          'payment_status', payment_status,
          'is_duplicate', true
        )
        FROM public.orders
        WHERE id = v_existing_order_id
      );
    ELSE
      RAISE EXCEPTION 'Idempotency conflict: processing request in progress';
    END IF;
  END IF;

  -- 2. Resolve shipping address & delivery fee
  SELECT pincode INTO v_address_pincode FROM public.addresses WHERE id = p_address_id AND user_id = v_user_id;
  IF v_address_pincode IS NULL THEN
    RAISE EXCEPTION 'Invalid delivery address';
  END IF;

  -- Get active zone fee
  SELECT delivery_charge INTO v_delivery_zone_fee 
  FROM public.delivery_zones 
  WHERE pincode = TRIM(v_address_pincode) AND is_active = true LIMIT 1;
  
  IF v_delivery_zone_fee IS NOT NULL THEN
    v_shipping_fee := v_delivery_zone_fee;
  ELSE
    -- Get default fallback fee from settings
    SELECT COALESCE((value->>'deliveryFee')::DECIMAL(10,2), 60.00) INTO v_default_delivery_fee 
    FROM public.settings 
    WHERE category = 'shipping' LIMIT 1;
    v_shipping_fee := COALESCE(v_default_delivery_fee, 60.00);
  END IF;

  -- 3. Calculate items subtotal and retrieve snapshots
  FOR v_item IN SELECT (value->>'variant_id')::UUID AS variant_id, (value->>'quantity')::INT AS quantity FROM jsonb_array_elements(p_items) LOOP
    SELECT fiv.price, fiv.label, fi.name INTO v_variant
    FROM public.food_item_variants fiv
    JOIN public.food_items fi ON fiv.food_item_id = fi.id
    WHERE fiv.id = v_item.variant_id AND fiv.status = 'active';

    IF v_variant IS NULL THEN
      RAISE EXCEPTION 'Invalid or inactive variant selected';
    END IF;

    v_subtotal := v_subtotal + (v_variant.price * v_item.quantity);
  END LOOP;

  -- 4. Coupon Validation & Discount Calculations
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) AND is_active = true LIMIT 1;
    
    IF v_coupon IS NULL THEN
      RAISE EXCEPTION 'Invalid or inactive coupon code';
    END IF;

    IF v_coupon.end_date IS NOT NULL AND v_coupon.end_date < now() THEN
      RAISE EXCEPTION 'Coupon code has expired';
    END IF;

    IF v_subtotal < COALESCE(v_coupon.min_order_amount, 0) THEN
      RAISE EXCEPTION 'Minimum order amount for coupon not met';
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'Coupon campaign usage limit reached';
    END IF;

    SELECT COUNT(*) INTO v_coupon_user_count FROM public.coupon_redemptions WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_coupon.max_uses_per_user IS NOT NULL AND v_coupon_user_count >= v_coupon.max_uses_per_user THEN
      RAISE EXCEPTION 'Coupon maximum uses per user reached';
    END IF;

    -- Calculate discounts
    IF v_coupon.type = 'flat' THEN
      v_discount := v_coupon.value;
    ELSIF v_coupon.type = 'percentage' THEN
      v_discount := (v_subtotal * v_coupon.value) / 100.00;
      IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
      END IF;
    ELSIF v_coupon.type = 'free_shipping' THEN
      v_discount := v_shipping_fee;
    END IF;

    -- Bound discount by subtotal
    v_discount := LEAST(v_discount, v_subtotal);
  END IF;

  v_final_amount := GREATEST(0.00, v_subtotal - v_discount + v_shipping_fee);

  -- 5. Insert Order Header (Always in 'pending' first to ensure order items exist in DB for triggers)
  INSERT INTO public.orders (user_id, address_id, total_amount, status, payment_status, created_at, updated_at)
  VALUES (v_user_id, p_address_id, v_final_amount, 'pending', 'pending', now(), now())
  RETURNING id INTO v_order_id;

  -- 6. Insert Order Items with snapshots
  FOR v_item IN SELECT (value->>'variant_id')::UUID AS variant_id, (value->>'quantity')::INT AS quantity FROM jsonb_array_elements(p_items) LOOP
    SELECT fiv.price, fiv.label, fi.name, fi.id AS food_item_id INTO v_variant
    FROM public.food_item_variants fiv
    JOIN public.food_items fi ON fiv.food_item_id = fi.id
    WHERE fiv.id = v_item.variant_id;

    v_item_price := v_variant.price;
    
    INSERT INTO public.order_items (
      order_id,
      food_item_id,
      variant_id,
      quantity,
      unit_price,
      subtotal,
      product_name_snapshot,
      variant_name_snapshot,
      created_at
    ) VALUES (
      v_order_id,
      v_variant.food_item_id,
      v_item.variant_id,
      v_item.quantity,
      v_item_price,
      v_item_price * v_item.quantity,
      v_variant.name,
      v_variant.label,
      now()
    );
  END LOOP;

  -- 7. Insert Coupon Redemption if applicable
  IF v_coupon IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_amount, created_at)
    VALUES (v_coupon.id, v_user_id, v_order_id, v_discount, now());
  END IF;

  -- 8. If COD, transition order to 'confirmed' status to execute stock allocation
  IF p_payment_method = 'cod' THEN
    UPDATE public.orders 
    SET status = 'confirmed' 
    WHERE id = v_order_id;
  END IF;

  -- 9. Fetch the final status (in case the trigger shifted it to 'payment_review' due to stock depletion)
  SELECT status, payment_status INTO v_order_status, v_payment_status 
  FROM public.orders 
  WHERE id = v_order_id;

  -- 10. Record customer activity
  INSERT INTO public.customer_activity (customer_id, activity_type, description, metadata, created_at)
  VALUES (
    v_user_id,
    'order_placed',
    'Order #' || UPPER(SUBSTRING(v_order_id::TEXT, 1, 8)) || ' placed via ' || UPPER(p_payment_method) || ' (Status: ' || v_order_status || ')',
    jsonb_build_object('order_id', v_order_id, 'total_amount', v_final_amount),
    now()
  );

  -- Update checkout_requests record with created order_id
  UPDATE public.checkout_requests SET order_id = v_order_id WHERE idempotency_key = p_idempotency_key;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total_amount', v_final_amount,
    'status', v_order_status,
    'payment_status', v_payment_status,
    'is_duplicate', false
  );
END;
$$;


-- ==========================================
-- 7. BEFORE INVENTORY ALLOCATION TRIGGER (PAYMENT_REVIEW ROUTING)
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
AS $$
DECLARE
  item_row RECORD;
  wh_row RECORD;
  alloc RECORD;
  total_available INT;
  remaining_needed INT;
  ws_qty INT;
  ws_reserved INT;
  available_qty INT;
  reserve_qty INT;
  old_status_val TEXT;
  new_status_val TEXT;
BEGIN
  old_status_val := COALESCE(OLD.status, 'pending');
  new_status_val := COALESCE(NEW.status, 'pending');

  -- If status didn't change, do nothing
  IF old_status_val = new_status_val AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Scenario A: Order transitions to 'confirmed' (Reserve stock across warehouses)
  IF (old_status_val = 'pending' AND new_status_val = 'confirmed') OR (TG_OP = 'INSERT' AND new_status_val = 'confirmed') THEN
    
    -- Verify stock availability first for all items
    FOR item_row IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF item_row.variant_id IS NOT NULL THEN
        -- Check total available stock across active warehouses
        SELECT COALESCE(SUM(ws.quantity - ws.reserved_stock), 0) INTO total_available
        FROM public.warehouse_stock ws
        JOIN public.warehouses w ON ws.warehouse_id = w.id
        WHERE ws.variant_id = item_row.variant_id AND w.is_active = true;

        IF total_available < item_row.quantity THEN
          -- Stock depleted! Route order to payment_review status instead of raising exception
          NEW.status := 'payment_review';
          NEW.payment_review_reason := 'stock_unavailable';

          -- 1. Insert admin alert notification
          INSERT INTO public.notifications (title, message, type, user_id, is_read, created_at)
          VALUES (
            'Payment Review: Stock Depleted',
            'Order #' || NEW.id || ' requires review. Stock variant ' || item_row.variant_id || ' is depleted.',
            'stock',
            NEW.user_id,
            false,
            now()
          );

          -- 2. Insert audit log
          INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, created_at)
          VALUES (
            NEW.user_id,
            'payment_review_depleted',
            'order',
            NEW.id::TEXT,
            jsonb_build_object('old_status', old_status_val),
            jsonb_build_object('new_status', 'payment_review', 'reason', 'stock_unavailable', 'missing_variant_id', item_row.variant_id),
            now()
          );

          RETURN NEW;
        END IF;
      END IF;
    END LOOP;

    -- If stock is sufficient, execute allocation and locking
    FOR item_row IN SELECT id, variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF item_row.variant_id IS NOT NULL THEN
        remaining_needed := item_row.quantity;

        -- Iterate active warehouses with available stock (highest first)
        FOR wh_row IN 
          SELECT ws.warehouse_id, (ws.quantity - ws.reserved_stock) AS available
          FROM public.warehouse_stock ws
          JOIN public.warehouses w ON ws.warehouse_id = w.id
          WHERE ws.variant_id = item_row.variant_id 
            AND w.is_active = true 
            AND (ws.quantity - ws.reserved_stock) > 0
          ORDER BY (ws.quantity - ws.reserved_stock) DESC
        LOOP
          IF remaining_needed <= 0 THEN
            EXIT;
          END IF;

          -- Pessimistic locking of the stock row
          SELECT quantity, reserved_stock 
          INTO ws_qty, ws_reserved
          FROM public.warehouse_stock
          WHERE warehouse_id = wh_row.warehouse_id AND variant_id = item_row.variant_id
          FOR UPDATE;

          available_qty := ws_qty - ws_reserved;

          IF available_qty > 0 THEN
            reserve_qty := LEAST(available_qty, remaining_needed);

            -- Update warehouse_stock
            UPDATE public.warehouse_stock
            SET reserved_stock = reserved_stock + reserve_qty
            WHERE warehouse_id = wh_row.warehouse_id AND variant_id = item_row.variant_id;

            -- Record the allocation details
            INSERT INTO public.order_inventory_allocations (order_id, order_item_id, warehouse_id, variant_id, allocated_quantity)
            VALUES (NEW.id, item_row.id, wh_row.warehouse_id, item_row.variant_id, reserve_qty);

            -- Log reservation movement type
            INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
            VALUES (wh_row.warehouse_id, item_row.variant_id, 'reservation', -reserve_qty, 'Order Reservation for #' || NEW.id, now());

            remaining_needed := remaining_needed - reserve_qty;
          END IF;
        END LOOP;

        -- Fallback if concurrency race condition occurs during allocation loops
        IF remaining_needed > 0 THEN
          NEW.status := 'payment_review';
          NEW.payment_review_reason := 'allocation_failed';
          
          INSERT INTO public.notifications (title, message, type, user_id, is_read, created_at)
          VALUES (
            'Payment Review: Allocation Conflict',
            'Order #' || NEW.id || ' concurrency clash. variant ' || item_row.variant_id || ' during checkout allocation.',
            'stock',
            NEW.user_id,
            false,
            now()
          );

          RETURN NEW;
        END IF;
      END IF;
    END LOOP;

  -- Scenario B: Order transitions to 'delivered' (Deduct physical and release reservation)
  ELSIF old_status_val IN ('confirmed', 'packed', 'shipped') AND new_status_val = 'delivered' THEN
    FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
      UPDATE public.warehouse_stock
      SET quantity = GREATEST(0, quantity - alloc.allocated_quantity),
          reserved_stock = GREATEST(0, reserved_stock - alloc.allocated_quantity)
      WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;

      INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
      VALUES (alloc.warehouse_id, alloc.variant_id, 'out', -alloc.allocated_quantity, 'Order Delivered for #' || NEW.id, now());
    END LOOP;

  -- Scenario C: Order transitions to 'cancelled', 'returned', or 'refunded' (Release reserved stock)
  ELSIF old_status_val IN ('confirmed', 'packed', 'shipped') AND new_status_val IN ('cancelled', 'returned', 'refunded') THEN
    FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
      UPDATE public.warehouse_stock
      SET reserved_stock = GREATEST(0, reserved_stock - alloc.allocated_quantity)
      WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;

      INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
      VALUES (alloc.warehouse_id, alloc.variant_id, 'release', alloc.allocated_quantity, 'Order Cancelled/Released for #' || NEW.id, now());
    END LOOP;

  -- Scenario D: Order transitions to 'returned' or 'refunded' (Restore physical stock)
  ELSIF old_status_val IN ('delivered', 'return_requested') AND new_status_val IN ('returned', 'refunded') THEN
    FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
      UPDATE public.warehouse_stock
      SET quantity = quantity + alloc.allocated_quantity
      WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;

      INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
      VALUES (alloc.warehouse_id, alloc.variant_id, 'in', alloc.allocated_quantity, 'Order Returned/Refunded (Stock Restored) for #' || NEW.id, now());
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Drop and recreate trigger as BEFORE triggers to allow order status modification
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_change();


-- ==========================================
-- 8. EXPAND REALTIME ORDER NOTIFICATIONS FOR PAYMENT_REVIEW
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_order_notification()
RETURNS TRIGGER
AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  notif_title TEXT;
  notif_msg TEXT;
BEGIN
  old_status := COALESCE(OLD.status, 'pending');
  new_status := COALESCE(NEW.status, 'pending');

  IF old_status = new_status AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF new_status = 'confirmed' THEN
    notif_title := 'Order Confirmed';
    notif_msg := 'Vanakkam! Your order #' || NEW.id || ' has been confirmed and is being processed.';
  ELSIF new_status = 'packed' THEN
    notif_title := 'Order Packed';
    notif_msg := 'Great news! Your order #' || NEW.id || ' is packed and ready for dispatch.';
  ELSIF new_status = 'shipped' THEN
    notif_title := 'Order Shipped';
    notif_msg := 'Your order #' || NEW.id || ' has been shipped! Courier Partner: ' || COALESCE(NEW.courier_partner, 'Courier') || ', Tracking Number: ' || COALESCE(NEW.tracking_number, 'Pending') || '.';
  ELSIF new_status = 'delivered' THEN
    notif_title := 'Order Delivered';
    notif_msg := 'Your order #' || NEW.id || ' has been delivered. Enjoy the traditional taste!';
  ELSIF new_status = 'return_requested' THEN
    notif_title := 'Return Requested';
    notif_msg := 'We have received your return request for order #' || NEW.id || '. Our staff will review it shortly.';
  ELSIF new_status = 'returned' THEN
    notif_title := 'Order Returned';
    notif_msg := 'Your order #' || NEW.id || ' has been successfully returned.';
  ELSIF new_status = 'refunded' THEN
    notif_title := 'Order Refunded';
    notif_msg := 'Your refund for order #' || NEW.id || ' has been processed successfully.';
  ELSIF new_status = 'cancelled' THEN
    notif_title := 'Order Cancelled';
    notif_msg := 'Your order #' || NEW.id || ' has been cancelled.';
  ELSIF new_status = 'payment_review' THEN
    notif_title := 'Order Payment Under Review';
    notif_msg := 'Your payment has been received, but order #' || NEW.id || ' is under review due to stock availability. We will update you shortly.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (title, message, type, user_id, is_read, created_at)
  VALUES (notif_title, notif_msg, 'order', NEW.user_id, false, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';


-- ==========================================
-- 9. PRODUCTION PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_order_allocations_order_id ON public.order_inventory_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_customer_activity_customer_created ON public.customer_activity(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_created ON public.inventory_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_coupon ON public.coupon_redemptions(user_id, coupon_id);
CREATE INDEX IF NOT EXISTS idx_checkout_requests_user ON public.checkout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders(created_at DESC);
