-- Migration: Phase P4 Scalability & Aggregations
-- Date: 2026-06-21

-- 1. Create extra indexes as requested
CREATE INDEX IF NOT EXISTS idx_orders_user_created
ON public.orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_delivered
ON public.orders(status, delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_created
ON public.profiles(created_at DESC);

-- 2. Create customer_ltv_summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.customer_ltv_summary AS
WITH completed_orders_agg AS (
  SELECT
    user_id,
    COUNT(id) AS completed_orders_count,
    COALESCE(SUM(total_amount), 0) AS lifetime_value,
    MAX(created_at) AS last_order_date
  FROM public.orders
  WHERE status = 'delivered'
  GROUP BY user_id
)
SELECT
  p.id AS customer_id,
  p.full_name,
  p.phone,
  p.provider,
  p.created_at,
  COALESCE(coa.completed_orders_count, 0)::integer AS completed_orders_count,
  COALESCE(coa.lifetime_value, 0)::numeric AS lifetime_value,
  coa.last_order_date,
  CASE
    WHEN COALESCE(coa.completed_orders_count, 0) >= 10 OR COALESCE(coa.lifetime_value, 0) >= 10000 THEN 'VIP'
    WHEN COALESCE(coa.lifetime_value, 0) >= 5000 THEN 'High Value'
    WHEN coa.last_order_date IS NOT NULL AND (now() - coa.last_order_date) > INTERVAL '180 days' THEN 'Dormant'
    WHEN coa.last_order_date IS NOT NULL AND (now() - coa.last_order_date) > INTERVAL '90 days' THEN 'Inactive'
    WHEN coa.last_order_date IS NOT NULL AND (now() - coa.last_order_date) <= INTERVAL '30 days' THEN 'Active'
    ELSE 'Regular'
  END AS segment
FROM public.profiles p
LEFT JOIN completed_orders_agg coa ON p.id = coa.user_id
WHERE p.role = 'user';

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_ltv_summary_id 
ON public.customer_ltv_summary (customer_id);

-- 3. Materialized View Refresh Trigger Function & Triggers
CREATE OR REPLACE FUNCTION public.refresh_customer_ltv_summary()
RETURNS trigger AS $$
BEGIN
  -- Perform standard refresh as CONCURRENT is not allowed in transaction blocks
  REFRESH MATERIALIZED VIEW public.customer_ltv_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on Orders
DROP TRIGGER IF EXISTS refresh_customer_ltv_orders ON public.orders;
CREATE TRIGGER refresh_customer_ltv_orders
AFTER INSERT OR UPDATE OF status OR DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.refresh_customer_ltv_summary();

-- Trigger on Profiles
DROP TRIGGER IF EXISTS refresh_customer_ltv_profiles ON public.profiles;
CREATE TRIGGER refresh_customer_ltv_profiles
AFTER INSERT OR UPDATE OF role OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.refresh_customer_ltv_summary();

-- 4. Create audit_logs_view
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT
  al.id,
  al.user_id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.old_data,
  al.new_data,
  al.created_at,
  p.full_name AS actor_name,
  p.role AS actor_role
FROM public.audit_logs al
LEFT JOIN public.profiles p ON al.user_id = p.id;

-- 5. Create inventory_ledger_view
CREATE OR REPLACE VIEW public.inventory_ledger_view AS
SELECT
  ws.id,
  ws.warehouse_id,
  ws.variant_id,
  ws.quantity,
  ws.reserved_stock,
  ws.available_stock,
  ws.reorder_level,
  ws.created_at,
  w.name AS warehouse_name,
  w.location AS warehouse_location,
  w.is_active AS warehouse_active,
  fiv.name AS variant_name,
  fiv.weight AS variant_weight,
  fiv.price AS variant_price,
  fiv.sku AS variant_sku,
  fi.name AS food_item_name,
  fi.id AS food_item_id,
  CASE
    WHEN ws.available_stock <= 2 THEN 'critical'
    WHEN ws.reorder_level IS NOT NULL AND ws.available_stock <= ws.reorder_level AND ws.available_stock > 2 THEN 'warning'
    ELSE 'healthy'
  END AS stock_status
FROM public.warehouse_stock ws
LEFT JOIN public.warehouses w ON ws.warehouse_id = w.id
LEFT JOIN public.food_item_variants fiv ON ws.variant_id = fiv.id
LEFT JOIN public.food_items fi ON fiv.food_item_id = fi.id;

-- 6. Reports RPC Functions

-- RPC 1: Sales report KPIs
CREATE OR REPLACE FUNCTION public.get_sales_report_kpis(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  revenue numeric,
  orders bigint,
  aov numeric,
  refunds numeric,
  delivered bigint,
  cancelled bigint
) AS $$
DECLARE
  v_revenue numeric;
  v_orders bigint;
  v_aov numeric;
  v_refunds numeric;
  v_delivered bigint;
  v_cancelled bigint;
BEGIN
  SELECT
    COALESCE(SUM(total_amount), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO
    v_revenue,
    v_orders,
    v_delivered,
    v_cancelled
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date;

  IF v_orders > 0 THEN
    v_aov := v_revenue / v_orders;
  ELSE
    v_aov := 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_refunds
  FROM public.order_refunds
  WHERE status = 'approved' AND created_at >= p_start_date AND created_at <= p_end_date;

  RETURN QUERY SELECT v_revenue, v_orders, v_aov, v_refunds, v_delivered, v_cancelled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Sales report timeline
CREATE OR REPLACE FUNCTION public.get_sales_report_timeline(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  timeline_date date,
  sales numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date::date,
      p_end_date::date,
      '1 day'::interval
    )::date AS gs_date
  ),
  daily_sales AS (
    SELECT
      created_at::date AS ord_date,
      SUM(total_amount) AS total_sales
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY 1
  )
  SELECT
    ds.gs_date,
    COALESCE(s.total_sales, 0)::numeric AS sales
  FROM date_series ds
  LEFT JOIN daily_sales s ON ds.gs_date = s.ord_date
  ORDER BY ds.gs_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 3: Inventory report KPIs
CREATE OR REPLACE FUNCTION public.get_inventory_report_kpis(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  stock_valuation numeric,
  low_stock_count bigint,
  total_variants bigint,
  movement_count bigint
) AS $$
DECLARE
  v_valuation numeric;
  v_low_stock bigint;
  v_total_variants bigint;
  v_movement_count bigint;
BEGIN
  SELECT
    COALESCE(SUM(ws.quantity * fiv.price), 0),
    COUNT(*) FILTER (WHERE ws.quantity <= COALESCE(ws.reorder_level, 5)),
    COUNT(DISTINCT ws.variant_id)
  INTO
    v_valuation,
    v_low_stock,
    v_total_variants
  FROM public.warehouse_stock ws
  LEFT JOIN public.food_item_variants fiv ON ws.variant_id = fiv.id;

  SELECT COUNT(*)
  INTO v_movement_count
  FROM public.inventory_movements
  WHERE created_at >= p_start_date AND created_at <= p_end_date;

  RETURN QUERY SELECT v_valuation, v_low_stock, v_total_variants, v_movement_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 4: Warehouse stock sums
CREATE OR REPLACE FUNCTION public.get_warehouse_stocks()
RETURNS TABLE (
  name text,
  value bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(w.name, 'Unknown Warehouse')::text AS name,
    SUM(ws.quantity)::bigint AS value
  FROM public.warehouse_stock ws
  LEFT JOIN public.warehouses w ON ws.warehouse_id = w.id
  GROUP BY w.name
  ORDER BY 2 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 5: Coupon report
CREATE OR REPLACE FUNCTION public.get_coupon_report(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  id uuid,
  code text,
  campaign text,
  type text,
  usages bigint,
  discountGiven numeric,
  revenue numeric,
  aov numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH redemptions_agg AS (
    SELECT
      cr.coupon_id,
      COUNT(cr.id) AS usages_count,
      SUM(cr.discount_amount) AS total_discount,
      SUM(COALESCE(o.total_amount, 0)) AS total_revenue
    FROM public.coupon_redemptions cr
    LEFT JOIN public.orders o ON cr.order_id = o.id
    WHERE cr.created_at >= p_start_date AND cr.created_at <= p_end_date
    GROUP BY cr.coupon_id
  )
  SELECT
    c.id,
    c.code::text,
    COALESCE(c.campaign_name, 'Generic Promo')::text,
    c.type::text,
    COALESCE(ra.usages_count, 0)::bigint AS usages,
    COALESCE(ra.total_discount, 0)::numeric AS discountGiven,
    COALESCE(ra.total_revenue, 0)::numeric AS revenue,
    (CASE WHEN COALESCE(ra.usages_count, 0) > 0 THEN COALESCE(ra.total_revenue, 0) / ra.usages_count ELSE 0 END)::numeric AS aov
  FROM public.coupons c
  LEFT JOIN redemptions_agg ra ON c.id = ra.coupon_id
  ORDER BY usages DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 6: Customer report KPIs
CREATE OR REPLACE FUNCTION public.get_customer_report_kpis(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  newCustomers bigint,
  repeatRate numeric,
  vipCount bigint,
  dormantCount bigint,
  avgLtv numeric
) AS $$
DECLARE
  v_new_customers bigint;
  v_repeat_rate numeric;
  v_vip_count bigint;
  v_dormant_count bigint;
  v_avg_ltv numeric;
  v_total_customers bigint;
  v_repeat_customers bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_new_customers
  FROM public.profiles
  WHERE role = 'user' AND created_at >= p_start_date AND created_at <= p_end_date;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE completed_orders_count >= 2),
    COUNT(*) FILTER (WHERE segment = 'VIP'),
    COUNT(*) FILTER (WHERE segment = 'Dormant'),
    COALESCE(AVG(lifetime_value), 0)
  INTO
    v_total_customers,
    v_repeat_customers,
    v_vip_count,
    v_dormant_count,
    v_avg_ltv
  FROM public.customer_ltv_summary;

  IF v_total_customers > 0 THEN
    v_repeat_rate := (v_repeat_customers::numeric / v_total_customers::numeric) * 100;
  ELSE
    v_repeat_rate := 0;
  END IF;

  RETURN QUERY SELECT v_new_customers, v_repeat_rate, v_vip_count, v_dormant_count, v_avg_ltv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 7: Customer growth timeline
CREATE OR REPLACE FUNCTION public.get_customer_growth_timeline(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  timeline_date date,
  registrations bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date::date,
      p_end_date::date,
      '1 day'::interval
    )::date AS gs_date
  ),
  daily_registrations AS (
    SELECT
      created_at::date AS reg_date,
      COUNT(id) AS reg_count
    FROM public.profiles
    WHERE role = 'user' AND created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY 1
  )
  SELECT
    ds.gs_date,
    COALESCE(r.reg_count, 0)::bigint AS registrations
  FROM date_series ds
  LEFT JOIN daily_registrations r ON ds.gs_date = r.reg_date
  ORDER BY ds.gs_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 8: Customer segments counts for charts
CREATE OR REPLACE FUNCTION public.get_customer_report_segments()
RETURNS TABLE (
  name text,
  value bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    segment::text AS name,
    COUNT(*)::bigint AS value
  FROM public.customer_ltv_summary
  GROUP BY segment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
