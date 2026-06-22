-- Migration: Add Order Tracking, Fulfillment Timestamps, Notifications read_at, and Customer Notes for Phase 2 Client Operations
-- Date: 2026-06-20

-- 1. Add tracking and fulfillment timestamps to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS courier_partner TEXT,
ADD COLUMN IF NOT EXISTS dispatch_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. Create customer notes table for administrative logs
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add read_at timestamp to notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 4. Create additional performance indexes for heavy queries
CREATE INDEX IF NOT EXISTS idx_orders_tracking
ON public.orders(tracking_number);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
ON public.order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_customer_activity_customer
ON public.customer_activity(customer_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order
ON public.order_refunds(order_id);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer
ON public.customer_notes(customer_id);
