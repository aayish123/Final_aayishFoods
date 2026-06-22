import { supabase } from '@/integrations/supabase/client';

export interface CouponInput {
  code: string;
  type: 'flat' | 'percentage' | 'free_shipping' | 'bogo' | 'referral' | 'birthday' | 'category_specific' | 'product_specific' | 'first_order' | 'festival_campaign';
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  max_uses_per_user: number;
  is_active: boolean;
  category_id?: string | null;
  food_item_id?: string | null;
  campaign_name?: string | null;
}

export const couponService = {
  fetchCoupons: async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  fetchActiveCoupons: async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  validateCoupon: async (code: string) => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();
      
    if (error) throw error;
    return data;
  },

  createCoupon: async (coupon: CouponInput) => {
    const { data, error } = await supabase
      .from('coupons')
      .insert([coupon])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateCoupon: async (id: string, coupon: Partial<CouponInput>) => {
    const { data, error } = await supabase
      .from('coupons')
      .update(coupon)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteCoupon: async (id: string) => {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  fetchCouponRedemptions: async (couponId: string) => {
    const { data, error } = await supabase
      .from('coupon_redemptions')
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone
        ),
        orders:order_id (
          total_amount
        )
      `)
      .eq('coupon_id', couponId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};
