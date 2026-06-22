-- Migration: Hardening Stock Concurrency, Multi-Warehouse Allocation, Status Simplification, and Notifications Automation
-- Date: 2026-06-20

-- 1. Create order_inventory_allocations table with requested foreign keys and uniqueness constraint
CREATE TABLE IF NOT EXISTS public.order_inventory_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    variant_id UUID NOT NULL REFERENCES public.food_item_variants(id),
    allocated_quantity INTEGER NOT NULL CHECK (allocated_quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_order_item_warehouse_variant UNIQUE (order_item_id, warehouse_id, variant_id)
);

-- Enable RLS on allocations
ALTER TABLE public.order_inventory_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage order allocations" ON public.order_inventory_allocations;
CREATE POLICY "Admins can manage order allocations" ON public.order_inventory_allocations FOR ALL USING (public.is_admin(auth.uid()));

-- 2. Expand inventory_movements type checks to support reservation and release
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_type_check 
  CHECK (type IN ('in', 'out', 'adjustment', 'transfer', 'audit', 'reservation', 'release'));

-- 3. Simplify order statuses (migrate data and re-apply check constraint)
UPDATE public.orders SET status = 'confirmed' WHERE status = 'preparing';
UPDATE public.orders SET status = 'shipped' WHERE status = 'out_for_delivery';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'));

-- 4. Correct any inconsistent stock states before applying constraint
UPDATE public.warehouse_stock 
SET reserved_stock = quantity 
WHERE reserved_stock > quantity;

-- 5. Add CHECK constraint to prevent reserved_stock from exceeding physical quantity
ALTER TABLE public.warehouse_stock DROP CONSTRAINT IF EXISTS check_available_stock_positive;
ALTER TABLE public.warehouse_stock ADD CONSTRAINT check_available_stock_positive CHECK (quantity >= reserved_stock);

-- 6. Upgrade trigger function to enforce atomic multi-warehouse reservations, locks, and return flows
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
    FOR item_row IN SELECT id, food_item_id, variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF item_row.variant_id IS NOT NULL THEN
        
        -- Check total available stock across all active warehouses
        SELECT COALESCE(SUM(ws.quantity - ws.reserved_stock), 0) INTO total_available
        FROM public.warehouse_stock ws
        JOIN public.warehouses w ON ws.warehouse_id = w.id
        WHERE ws.variant_id = item_row.variant_id 
          AND w.is_active = true;

        IF total_available < item_row.quantity THEN
          RAISE EXCEPTION 'Insufficient stock for variant %: requested %, total available %', 
            item_row.variant_id, item_row.quantity, total_available;
        END IF;

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

          -- Pessimistic locking of the stock row to serialize concurrent allocations
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

        -- Check for concurrent shortage failures
        IF remaining_needed > 0 THEN
          RAISE EXCEPTION 'Concurrency clash: Insufficient stock for variant %: remaining needed %', 
            item_row.variant_id, remaining_needed;
        END IF;

      END IF;
    END LOOP;

  -- Scenario B: Order transitions from pre-delivery to 'delivered' (Deduct physical stock and release reservation)
  ELSIF old_status_val IN ('confirmed', 'packed', 'shipped') AND new_status_val = 'delivered' THEN
    FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
      -- Decrease physical stock (quantity) and decrease reserved stock based on original allocation record
      UPDATE public.warehouse_stock
      SET quantity = GREATEST(0, quantity - alloc.allocated_quantity),
          reserved_stock = GREATEST(0, reserved_stock - alloc.allocated_quantity)
      WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;

      -- Log actual stock out
      INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
      VALUES (alloc.warehouse_id, alloc.variant_id, 'out', -alloc.allocated_quantity, 'Order Delivered for #' || NEW.id, now());
    END LOOP;

  -- Scenario C: Order transitions from pre-delivery to 'cancelled', 'returned', or 'refunded' (Release reserved stock)
  ELSIF old_status_val IN ('confirmed', 'packed', 'shipped') AND new_status_val IN ('cancelled', 'returned', 'refunded') THEN
    FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
      -- Release reserved stock, physical stock remains unchanged
      UPDATE public.warehouse_stock
      SET reserved_stock = GREATEST(0, reserved_stock - alloc.allocated_quantity)
      WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;

      -- Log release movement type
      INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
      VALUES (alloc.warehouse_id, alloc.variant_id, 'release', alloc.allocated_quantity, 'Order Cancelled/Released for #' || NEW.id, now());
    END LOOP;

  -- Scenario D: Order transitions from 'delivered' or 'return_requested' to 'returned' or 'refunded' (Restore physical stock)
  ELSIF old_status_val IN ('delivered', 'return_requested') AND new_status_val IN ('returned', 'refunded') THEN
    FOR alloc IN SELECT warehouse_id, variant_id, allocated_quantity FROM public.order_inventory_allocations WHERE order_id = NEW.id LOOP
      -- Increase physical stock (quantity) back to original warehouse
      UPDATE public.warehouse_stock
      SET quantity = quantity + alloc.allocated_quantity
      WHERE warehouse_id = alloc.warehouse_id AND variant_id = alloc.variant_id;

      -- Log incoming restoration
      INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
      VALUES (alloc.warehouse_id, alloc.variant_id, 'in', alloc.allocated_quantity, 'Order Returned/Refunded (Stock Restored) for #' || NEW.id, now());
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create notification trigger function and trigger to automate order status client alerts
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
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (title, message, type, user_id, is_read, created_at)
  VALUES (notif_title, notif_msg, 'order', NEW.user_id, false, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_status_notification ON public.orders;
CREATE TRIGGER on_order_status_notification
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_notification();
