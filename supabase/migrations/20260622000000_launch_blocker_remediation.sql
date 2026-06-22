-- Migration: Launch Blocker Remediation
-- Date: 2026-06-22

-- 1. Update customer_activity CHECK constraint
ALTER TABLE public.customer_activity DROP CONSTRAINT IF EXISTS customer_activity_activity_type_check;
ALTER TABLE public.customer_activity ADD CONSTRAINT customer_activity_activity_type_check 
  CHECK (activity_type IN ('login', 'order_placed', 'review_submitted', 'coupon_used', 'wishlist_added', 'cart_activity', 'profile_updated', 'order_cancelled', 'coupon_applied', 'coupon_removed', 'search_performed'));

-- 2. Create admin_update_order_status RPC
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_updates JSONB,
  p_notes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_user_id UUID;
BEGIN
  -- Authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check admin edit permission on orders
  IF NOT public.has_permission(v_user_id, 'edit', 'orders') THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Get current order status
  SELECT status INTO v_old_status
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_new_status := COALESCE(p_updates->>'status', v_old_status);

  -- Perform fields updates
  UPDATE public.orders
  SET 
    status = COALESCE(p_updates->>'status', status),
    payment_status = COALESCE(p_updates->>'payment_status', payment_status),
    payment_review_reason = CASE 
      WHEN p_updates ? 'payment_review_reason' THEN (p_updates->>'payment_review_reason')
      ELSE payment_review_reason 
    END,
    packed_at = CASE 
      WHEN p_updates ? 'packed_at' THEN (p_updates->>'packed_at')::TIMESTAMPTZ
      ELSE packed_at 
    END,
    shipped_at = CASE 
      WHEN p_updates ? 'shipped_at' THEN (p_updates->>'shipped_at')::TIMESTAMPTZ
      ELSE shipped_at 
    END,
    delivered_at = CASE 
      WHEN p_updates ? 'delivered_at' THEN (p_updates->>'delivered_at')::TIMESTAMPTZ
      ELSE delivered_at 
    END,
    courier_partner = CASE 
      WHEN p_updates ? 'courier_partner' THEN (p_updates->>'courier_partner')
      ELSE courier_partner 
    END,
    tracking_number = CASE 
      WHEN p_updates ? 'tracking_number' THEN (p_updates->>'tracking_number')
      ELSE tracking_number 
    END,
    dispatch_date = CASE 
      WHEN p_updates ? 'dispatch_date' THEN (p_updates->>'dispatch_date')::TIMESTAMPTZ
      ELSE dispatch_date 
    END,
    updated_at = now()
  WHERE id = p_order_id;

  -- Insert status history entry
  INSERT INTO public.order_status_history (
    order_id,
    old_status,
    new_status,
    notes,
    changed_by
  ) VALUES (
    p_order_id,
    v_old_status,
    v_new_status,
    p_notes,
    v_user_id
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, JSONB, TEXT) TO authenticated;

-- 3 & 4. Update stock reservation trigger handle_order_status_change
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
    
    -- Fix: Clear stale allocations and release reserved stock first if transitioning from payment_review
    IF old_status_val = 'payment_review' THEN
      FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
        UPDATE public.warehouse_stock
        SET reserved_stock = GREATEST(0, reserved_stock - alloc.allocated_quantity)
        WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;
        
        INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
        VALUES (alloc.warehouse_id, alloc.variant_id, 'release', alloc.allocated_quantity, 'Stale Order Reservation Released (Rebuilding) for #' || NEW.id, now());
      END LOOP;
      
      DELETE FROM public.order_inventory_allocations WHERE order_id = NEW.id;
    END IF;

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
  -- Fix: Include payment_review in stock release scenario
  ELSIF old_status_val IN ('confirmed', 'packed', 'shipped', 'payment_review') AND new_status_val IN ('cancelled', 'returned', 'refunded') THEN
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

-- 5. Redefine cancel_user_order to allow customer COD cancellation within 15 mins for pending, confirmed, or payment_review
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

  -- Select and lock the order row, checking that it belongs to the caller
  SELECT status, created_at INTO v_order_status, v_created_at
  FROM public.orders
  WHERE id = p_order_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status NOT IN ('pending', 'confirmed', 'payment_review') THEN
    RAISE EXCEPTION 'Only pending, confirmed, or payment review orders can be cancelled by customers';
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
    v_order_status,
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

-- 6. Redefine validate_coupon_redemption to use items subtotal, excluding shipping fee
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

  -- Verify minimum order value is met on the items subtotal only (excludes shipping fee)
  SELECT COALESCE(SUM(subtotal), 0) INTO v_order_amount 
  FROM public.order_items 
  WHERE order_id = NEW.order_id;
  
  IF v_coupon.min_order_amount IS NOT NULL AND v_order_amount < v_coupon.min_order_amount THEN
    RAISE EXCEPTION 'Order amount is below the minimum required spend of ₹%', v_coupon.min_order_amount;
  END IF;

  RETURN NEW;
END;
$$;
