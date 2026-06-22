import { supabase } from '@/integrations/supabase/client';

export interface CustomerNoteInput {
  customerId: string;
  adminId: string;
  note: string;
}

export const customerService = {
  fetchCustomersPaginated: async (
    page: number,
    pageSize: number,
    search: string,
    segment: string
  ) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('customer_ltv_summary' as any)
      .select('*', { count: 'exact' });

    if (segment && segment !== 'all') {
      let normalizedSegment = segment;
      if (segment.toLowerCase() === 'vip') normalizedSegment = 'VIP';
      else if (segment.toLowerCase() === 'high value') normalizedSegment = 'High Value';
      else if (segment.toLowerCase() === 'active') normalizedSegment = 'Active';
      else if (segment.toLowerCase() === 'inactive') normalizedSegment = 'Inactive';
      else if (segment.toLowerCase() === 'dormant') normalizedSegment = 'Dormant';
      else if (segment.toLowerCase() === 'regular') normalizedSegment = 'Regular';

      query = query.eq('segment', normalizedSegment);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,customer_id.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data || [],
      count: count || 0
    };
  },

  fetchCustomerSegmentCounts: async () => {
    const [vip, highValue, active, dormant] = await Promise.all([
      supabase.from('customer_ltv_summary' as any).select('*', { count: 'exact', head: true }).eq('segment', 'VIP'),
      supabase.from('customer_ltv_summary' as any).select('*', { count: 'exact', head: true }).eq('segment', 'High Value'),
      supabase.from('customer_ltv_summary' as any).select('*', { count: 'exact', head: true }).eq('segment', 'Active'),
      supabase.from('customer_ltv_summary' as any).select('*', { count: 'exact', head: true }).eq('segment', 'Dormant')
    ]);

    return {
      vip: vip.count || 0,
      highValue: highValue.count || 0,
      active: active.count || 0,
      dormant: dormant.count || 0
    };
  },


  fetchCustomerDetail: async (id: string) => {
    // Fetch profile, addresses, notes, activity, orders, reviews, and wishlist count in parallel
    const [
      profileResult,
      addressesResult,
      notesResult,
      activityResult,
      ordersResult,
      reviewsResult,
      wishlistResult
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('addresses')
        .select('*')
        .eq('user_id', id),
      supabase
        .from('customer_notes')
        .select(`
          *,
          profiles:admin_id (
            full_name
          )
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('customer_activity')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('orders')
        .select('id, created_at, total_amount, status, payment_status')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, rating, comment, status, is_featured, created_at, food_items(name)')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('wishlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id)
    ]);

    if (profileResult.error) throw profileResult.error;

    return {
      profile: profileResult.data,
      addresses: addressesResult.data || [],
      notes: notesResult.data || [],
      activity: activityResult.data || [],
      orders: ordersResult.data || [],
      reviews: reviewsResult.data || [],
      wishlistCount: wishlistResult.count || 0
    };
  },

  updateCustomerStatus: async (customerId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive } as any)
      .eq('id', customerId);
    if (error) throw error;
    return true;
  },

  createCustomerNote: async (input: CustomerNoteInput) => {
    const { error } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: input.customerId,
        admin_id: input.adminId,
        note: input.note
      });
    if (error) throw error;
    return true;
  },

  updateCustomerNote: async (noteId: string, note: string) => {
    const { error } = await supabase
      .from('customer_notes')
      .update({ note })
      .eq('id', noteId);
    if (error) throw error;
    return true;
  },

  deleteCustomerNote: async (noteId: string) => {
    const { error } = await supabase
      .from('customer_notes')
      .delete()
      .eq('id', noteId);
    if (error) throw error;
    return true;
  },

  fetchCustomerActivity: async (customerId: string, page: number, pageSize: number) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('customer_activity')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }
};
