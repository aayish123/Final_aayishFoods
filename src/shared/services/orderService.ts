import { supabase } from '@/integrations/supabase/client';

export interface CheckoutInput {
  addressId: string;
  couponCode: string | null;
  items: { variant_id: string; quantity: number }[];
  paymentMethod: string;
  idempotencyKey: string;
}

export const orderService = {
  // RPC Checkout Order Placement
  createCheckoutOrder: async (input: CheckoutInput) => {
    const { data, error } = await (supabase.rpc as any)('create_checkout_order', {
      p_address_id: input.addressId,
      p_coupon_code: input.couponCode || null,
      p_items: input.items,
      p_payment_method: input.paymentMethod,
      p_idempotency_key: input.idempotencyKey
    });
    if (error) throw error;
    return data;
  },

  // Paginated admin orders list query
  fetchOrders: async (params: { 
    page: number; 
    pageSize: number; 
    statusFilter?: string; 
    searchTerm?: string;
  }) => {
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;

    let query = supabase
      .from('orders')
      .select(`
        *,
        addresses:address_id (
          full_name,
          phone,
          city,
          pincode,
          address_line1,
          address_line2,
          state
        ),
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          product_name_snapshot,
          variant_name_snapshot,
          food_items (
            name
          )
        )
      `, { count: 'exact' });

    if (params.statusFilter && params.statusFilter !== 'all') {
      if (params.statusFilter === 'packing') {
        query = query.eq('status', 'confirmed').in('payment_status', ['completed', 'paid']);
      } else if (params.statusFilter === 'shipping') {
        query = query.eq('status', 'packed');
      } else if (params.statusFilter === 'delivered_queue') {
        query = query.eq('status', 'shipped');
      } else {
        query = query.eq('status', params.statusFilter);
      }
    }

    if (params.searchTerm) {
      const term = `%${params.searchTerm}%`;
      query = query.or(`id.ilike.${term},payment_review_reason.ilike.${term}`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  fetchCustomerOrders: async (userId: string, page: number = 1, pageSize: number = 5) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          product_name_snapshot,
          variant_name_snapshot,
          food_items (
            name,
            image_url
          )
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  fetchOrderDetail: async (orderId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        addresses:address_id (
          full_name,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          pincode
        ),
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          product_name_snapshot,
          variant_name_snapshot,
          food_items (
            name,
            image_url
          ),
          food_item_variants (
            label
          )
        ),
        order_status_history (
          id,
          old_status,
          new_status,
          notes,
          changed_at,
          profiles:changed_by (
            full_name
          )
        ),
        order_notes (
          id,
          note,
          created_at,
          profiles:admin_id (
            full_name
          )
        ),
        order_refunds (
          id,
          amount,
          reason,
          status,
          created_at
        ),
        coupon_redemptions (
          id,
          discount_amount,
          coupons (
            code,
            type,
            value
          )
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  updateOrderStatus: async (orderId: string, updates: Record<string, unknown>, notes: string, changedBy?: string) => {
    const { data, error } = await (supabase.rpc as any)('admin_update_order_status', {
      p_order_id: orderId,
      p_updates: updates,
      p_notes: notes
    });
    if (error) throw error;
    return true;
  },

  createOrderNote: async (orderId: string, adminId: string, note: string) => {
    const { error } = await supabase
      .from('order_notes')
      .insert({
        order_id: orderId,
        admin_id: adminId,
        note
      });
    if (error) throw error;
    return true;
  },

  fetchRefundRequests: async () => {
    const { data, error } = await supabase
      .from('order_refunds')
      .select(`
        *,
        orders:order_id (
          total_amount,
          user_id,
          addresses:address_id (
            full_name
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  processRefund: async (refundId: string, approve: boolean, notes: string, adminId: string) => {
    const status = approve ? 'approved' : 'failed';
    const nowString = new Date().toISOString();

    // 1. Retrieve refund details
    const { data: refund, error: getErr } = await supabase
      .from('order_refunds')
      .select('order_id, amount')
      .eq('id', refundId)
      .single();
    if (getErr) throw getErr;

    // 2. Update refund record
    const { error: refundErr } = await supabase
      .from('order_refunds')
      .update({
        status,
        approved_by: adminId,
        updated_at: nowString
      })
      .eq('id', refundId);
    if (refundErr) throw refundErr;

    // 3. If approved, update order
    if (approve && refund) {
      await orderService.updateOrderStatus(
        refund.order_id,
        {
          status: 'refunded',
          payment_status: 'refunded'
        },
        notes || `Refund of ₹${Number(refund.amount).toFixed(2)} approved by administrator.`,
        adminId
      );
    } else if (refund) {
      // If rejected, write note history
      await orderService.updateOrderStatus(
        refund.order_id,
        { status: 'returned' },
        `Refund claim rejected. Reason: ${notes || 'N/A'}`,
        adminId
      );
    }

    return true;
  }
};
