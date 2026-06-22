-- Migration: Add variant_id to order_items, trigger for inventory lifecycle, customer_addresses view, and checkout policies
-- Date: 2026-06-20

-- 1. Add variant_id column to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.food_item_variants(id) ON DELETE SET NULL;

-- 2. Enable SELECT access for warehouse_stock to users and guests for available stock checks
DROP POLICY IF EXISTS "Anyone can view warehouse stock" ON public.warehouse_stock;
CREATE POLICY "Anyone can view warehouse stock" ON public.warehouse_stock
  FOR SELECT TO authenticated, anon USING (true);

-- 3. Enable INSERT access for coupon_redemptions for checking out users
DROP POLICY IF EXISTS "Users can create their own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users can create their own redemptions" ON public.coupon_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Create customer_addresses view alias for addresses table
CREATE OR REPLACE VIEW public.customer_addresses AS 
SELECT * FROM public.addresses;

-- 5. Create trigger function to handle automatic stock reservation, delivery deduction, and cancellations
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
AS $$
DECLARE
  item_row RECORD;
  wh_id UUID;
  old_status_val TEXT;
  new_status_val TEXT;
BEGIN
  old_status_val := COALESCE(OLD.status, 'pending');
  new_status_val := COALESCE(NEW.status, 'pending');

  -- If status didn't change, do nothing
  IF old_status_val = new_status_val AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Scenario A: Order transitions to 'confirmed' (Reserve stock)
  IF (old_status_val = 'pending' AND new_status_val = 'confirmed') OR (TG_OP = 'INSERT' AND new_status_val = 'confirmed') THEN
    FOR item_row IN SELECT food_item_id, variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF item_row.variant_id IS NOT NULL THEN
        -- Find active warehouse with the highest available stock for this variant (deterministic allocation logic)
        SELECT ws.warehouse_id INTO wh_id 
        FROM public.warehouse_stock ws
        JOIN public.warehouses w ON ws.warehouse_id = w.id
        WHERE ws.variant_id = item_row.variant_id 
          AND w.is_active = true 
        ORDER BY (ws.quantity - ws.reserved_stock) DESC 
        LIMIT 1;

        -- Fallback to first active warehouse if no record exists
        IF wh_id IS NULL THEN
          SELECT id INTO wh_id FROM public.warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
        END IF;

        IF wh_id IS NOT NULL THEN
          -- Increase reserved stock
          INSERT INTO public.warehouse_stock (warehouse_id, variant_id, quantity, reserved_stock)
          VALUES (wh_id, item_row.variant_id, 0, item_row.quantity)
          ON CONFLICT (warehouse_id, variant_id) DO UPDATE
          SET reserved_stock = public.warehouse_stock.reserved_stock + item_row.quantity;

          -- Create movement log
          INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
          VALUES (wh_id, item_row.variant_id, 'out', -item_row.quantity, 'Order Reservation for #' || NEW.id, now());
        END IF;
      END IF;
    END LOOP;

  -- Scenario B: Order transitions from confirmed/processing to 'delivered' (Deduct physical and release reserved stock)
  ELSIF old_status_val IN ('confirmed', 'preparing', 'packed', 'shipped') AND new_status_val = 'delivered' THEN
    FOR item_row IN SELECT food_item_id, variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF item_row.variant_id IS NOT NULL THEN
        -- Find warehouse where stock was reserved for this order item
        SELECT ws.warehouse_id INTO wh_id 
        FROM public.warehouse_stock ws
        JOIN public.warehouses w ON ws.warehouse_id = w.id
        WHERE ws.variant_id = item_row.variant_id 
          AND ws.reserved_stock >= item_row.quantity
          AND w.is_active = true 
        LIMIT 1;

        -- Fallback to first active warehouse if no reservation record found
        IF wh_id IS NULL THEN
          SELECT id INTO wh_id FROM public.warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
        END IF;

        IF wh_id IS NOT NULL THEN
          -- Decrease physical stock (quantity) and decrease reserved stock
          UPDATE public.warehouse_stock
          SET quantity = GREATEST(0, quantity - item_row.quantity),
              reserved_stock = GREATEST(0, reserved_stock - item_row.quantity)
          WHERE warehouse_id = wh_id AND variant_id = item_row.variant_id;

          -- Create movement log
          INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
          VALUES (wh_id, item_row.variant_id, 'out', -item_row.quantity, 'Order Delivered for #' || NEW.id, now());
        END IF;
      END IF;
    END LOOP;

  -- Scenario C: Order transitions from confirmed/processing to 'cancelled', 'returned', or 'refunded' (Release reserved stock)
  ELSIF old_status_val IN ('confirmed', 'preparing', 'packed', 'shipped') AND new_status_val IN ('cancelled', 'returned', 'refunded') THEN
    FOR item_row IN SELECT food_item_id, variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      IF item_row.variant_id IS NOT NULL THEN
        -- Find warehouse where stock was reserved for this order item
        SELECT ws.warehouse_id INTO wh_id 
        FROM public.warehouse_stock ws
        JOIN public.warehouses w ON ws.warehouse_id = w.id
        WHERE ws.variant_id = item_row.variant_id 
          AND ws.reserved_stock >= item_row.quantity
          AND w.is_active = true 
        LIMIT 1;

        -- Fallback to first active warehouse if no reservation record found
        IF wh_id IS NULL THEN
          SELECT id INTO wh_id FROM public.warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
        END IF;

        IF wh_id IS NOT NULL THEN
          -- Release reserved stock, physical stock remains unchanged
          UPDATE public.warehouse_stock
          SET reserved_stock = GREATEST(0, reserved_stock - item_row.quantity)
          WHERE warehouse_id = wh_id AND variant_id = item_row.variant_id;

          -- Create restoration movement log (incoming type 'in' to restore available stock balance)
          INSERT INTO public.inventory_movements (warehouse_id, variant_id, type, quantity, reason, created_at)
          VALUES (wh_id, item_row.variant_id, 'in', item_row.quantity, 'Order Cancelled/Released for #' || NEW.id, now());
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach trigger to public.orders table
DROP TRIGGER IF EXISTS on_order_confirmed ON public.orders;
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_change();
