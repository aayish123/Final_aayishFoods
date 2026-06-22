-- Migration: Checkout & Fulfillment Hardening
-- Date: 2026-06-20
-- Ref: Hardening of RLS bypasses, state transitions validation, and coupon counts reversion

-- 1. Create the secure order cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_user_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order_status TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Select and lock the order row
  SELECT status, created_at INTO v_order_status, v_created_at
  FROM public.orders
  WHERE id = p_order_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending orders can be cancelled by customers';
  END IF;

  IF (v_created_at + interval '15 minutes' < now()) THEN
    RAISE EXCEPTION 'Cancellation window (15 minutes) has expired';
  END IF;

  -- Perform update
  UPDATE public.orders
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_order_id;

  -- Log customer activity
  INSERT INTO public.customer_activity (customer_id, activity_type, description, metadata, created_at)
  VALUES (
    v_user_id,
    'order_cancelled',
    'Order #' || UPPER(SUBSTRING(p_order_id::TEXT, 1, 8)) || ' cancelled by customer',
    jsonb_build_object('order_id', p_order_id),
    now()
  );

  -- Log status history
  INSERT INTO public.order_status_history (order_id, old_status, new_status, notes, changed_by)
  VALUES (
    p_order_id,
    'pending',
    'cancelled',
    'Order cancelled by customer within 15-minute window.',
    v_user_id
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'cancelled',
    'success', true
  );
END;
$$;


-- 2. Strict database-enforced state transition trigger
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_s TEXT;
  new_s TEXT;
  is_valid BOOLEAN := false;
BEGIN
  old_s := OLD.status;
  new_s := NEW.status;

  -- Allow if status doesn't change
  IF old_s = new_s THEN
    RETURN NEW;
  END IF;

  -- Validate transition rules
  IF (old_s = 'pending' AND new_s IN ('confirmed', 'cancelled', 'payment_review')) THEN
    is_valid := true;
  ELSIF (old_s = 'payment_review' AND new_s IN ('confirmed', 'cancelled')) THEN
    is_valid := true;
  ELSIF (old_s = 'confirmed' AND new_s IN ('packed', 'cancelled')) THEN
    is_valid := true;
  ELSIF (old_s = 'packed' AND new_s IN ('shipped', 'cancelled')) THEN
    is_valid := true;
  ELSIF (old_s = 'shipped' AND new_s IN ('delivered', 'cancelled')) THEN
    is_valid := true;
  ELSIF (old_s = 'delivered' AND new_s = 'return_requested') THEN
    is_valid := true;
  ELSIF (old_s = 'return_requested' AND new_s IN ('returned', 'refunded')) THEN
    is_valid := true;
  END IF;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Illegal order status transition from % to %', old_s, new_s;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_order_status_transition ON public.orders;
CREATE TRIGGER trigger_validate_order_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();


-- 3. Update stock reservation trigger to handle payment_review -> confirmed
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
  IF (old_status_val IN ('pending', 'payment_review') AND new_status_val = 'confirmed') OR (TG_OP = 'INSERT' AND new_status_val = 'confirmed') THEN
    
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


-- 4. Revert Coupon Redemptions and decrement usage counts on cancelled/returned/refunded order states
CREATE OR REPLACE FUNCTION public.revert_coupon_redemption()
RETURNS TRIGGER AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  IF NEW.status IN ('cancelled', 'returned', 'refunded') AND OLD.status NOT IN ('cancelled', 'returned', 'refunded') THEN
    FOR v_redemption IN SELECT id, coupon_id FROM public.coupon_redemptions WHERE order_id = NEW.id LOOP
      -- Deleting the redemption row will fire the coupon count decrement trigger
      DELETE FROM public.coupon_redemptions WHERE id = v_redemption.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_revert_coupon_redemption ON public.orders;
CREATE TRIGGER trigger_revert_coupon_redemption
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.revert_coupon_redemption();

-- Make sure coupon decrement trigger exists
CREATE OR REPLACE FUNCTION public.decrement_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.coupons
  SET usage_count = GREATEST(0, usage_count - 1),
      updated_at = now()
  WHERE id = OLD.coupon_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_decrement_coupon_usage ON public.coupon_redemptions;
CREATE TRIGGER trigger_decrement_coupon_usage
  AFTER DELETE ON public.coupon_redemptions
  FOR EACH ROW EXECUTE PROCEDURE public.decrement_coupon_usage();





-- 5. Harden direct writes security and explicit permission grants
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated, anon, public;

-- Revoke user direct writes on RLS policies
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;

-- Recreate SELECT policies only (direct writes are blocked)
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID, TEXT, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_user_order(UUID) TO authenticated;


-- 6. Permission-Based RLS Overhaul
-- order_inventory_allocations
DROP POLICY IF EXISTS "Admins can manage order allocations" ON public.order_inventory_allocations;
CREATE POLICY "Admins can view order allocations" ON public.order_inventory_allocations FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'orders'));
CREATE POLICY "Admins can manage order allocations" ON public.order_inventory_allocations FOR ALL USING (public.has_permission(auth.uid(), 'edit', 'orders')) WITH CHECK (public.has_permission(auth.uid(), 'edit', 'orders'));

-- coupon_redemptions
DROP POLICY IF EXISTS "Admins can view redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins can view redemptions" ON public.coupon_redemptions FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'marketing'));

-- warehouse_stock
DROP POLICY IF EXISTS "Admins can manage warehouse stock" ON public.warehouse_stock;
CREATE POLICY "Admins can view warehouse stock" ON public.warehouse_stock FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'inventory'));
CREATE POLICY "Admins can manage warehouse stock" ON public.warehouse_stock FOR ALL USING (public.has_permission(auth.uid(), 'edit', 'inventory')) WITH CHECK (public.has_permission(auth.uid(), 'edit', 'inventory'));

-- inventory_movements
DROP POLICY IF EXISTS "Admins can manage inventory movements" ON public.inventory_movements;
CREATE POLICY "Admins can view inventory movements" ON public.inventory_movements FOR SELECT USING (public.has_permission(auth.uid(), 'view', 'inventory'));
CREATE POLICY "Admins can manage inventory movements" ON public.inventory_movements FOR ALL USING (public.has_permission(auth.uid(), 'edit', 'inventory')) WITH CHECK (public.has_permission(auth.uid(), 'edit', 'inventory'));


-- 7. Create missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON public.order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id ON public.coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON public.inventory_movements(warehouse_id);
