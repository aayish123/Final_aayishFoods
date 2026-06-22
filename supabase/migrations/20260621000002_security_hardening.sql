-- Migration: Security Blocker Hardening
-- Date: 2026-06-21
-- Purpose: Protect database snapshots, secure reporting RPCs with permissions validation, and apply search_path = public to trigger and helper functions running under SECURITY DEFINER.

-- 1. Redefine create_database_snapshot to check super admin permissions and set search_path
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
  -- Validate caller has super admin permissions
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Super Administrator privileges required';
  END IF;

  -- Aggregating system configuration tables
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO settings_json FROM (SELECT * FROM public.settings) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO roles_json FROM (SELECT * FROM public.roles) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO permissions_json FROM (SELECT * FROM public.permissions) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO role_perms_json FROM (SELECT * FROM public.role_permissions) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO cms_sections_json FROM (SELECT * FROM public.cms_sections) t;
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO cms_history_json FROM (SELECT * FROM public.cms_publish_history) t;

  -- Build final aggregated JSON snapshot structure
  final_data := jsonb_build_object(
    'settings', settings_json,
    'roles', roles_json,
    'permissions', permissions_json,
    'role_permissions', role_perms_json,
    'cms_sections', cms_sections_json,
    'cms_publish_history', cms_history_json
  );

  -- Store snapshot record
  INSERT INTO public.database_snapshots (snapshot_type, snapshot_data)
  VALUES (snap_type, final_data)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


-- 2. Redefine refresh_customer_ltv_summary trigger with search_path = public
CREATE OR REPLACE FUNCTION public.refresh_customer_ltv_summary()
RETURNS trigger AS $$
BEGIN
  -- Perform standard refresh as CONCURRENT is not allowed in transaction blocks
  REFRESH MATERIALIZED VIEW public.customer_ltv_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Redefine all 8 reports/analytics RPC functions with access checking and search_path = public

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
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 2: Sales report timeline
CREATE OR REPLACE FUNCTION public.get_sales_report_timeline(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  timeline_date date,
  sales numeric
) AS $$
BEGIN
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


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
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 4: Warehouse stock sums
CREATE OR REPLACE FUNCTION public.get_warehouse_stocks()
RETURNS TABLE (
  name text,
  value bigint
) AS $$
BEGIN
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(w.name, 'Unknown Warehouse')::text AS name,
    SUM(ws.quantity)::bigint AS value
  FROM public.warehouse_stock ws
  LEFT JOIN public.warehouses w ON ws.warehouse_id = w.id
  GROUP BY w.name
  ORDER BY 2 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


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
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


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
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 7: Customer growth timeline
CREATE OR REPLACE FUNCTION public.get_customer_growth_timeline(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  timeline_date date,
  registrations bigint
) AS $$
BEGIN
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- RPC 8: Customer segments counts for charts
CREATE OR REPLACE FUNCTION public.get_customer_report_segments()
RETURNS TABLE (
  name text,
  value bigint
) AS $$
BEGIN
  -- Validate caller has view reports permission
  IF NOT public.has_permission(auth.uid(), 'view', 'reports') THEN
    RAISE EXCEPTION 'Access Denied: Reports viewing permissions required';
  END IF;

  RETURN QUERY
  SELECT
    segment::text AS name,
    COUNT(*)::bigint AS value
  FROM public.customer_ltv_summary
  GROUP BY segment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
