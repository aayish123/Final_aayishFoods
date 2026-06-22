import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Gift, Percent, Tag, ShieldCheck, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';
import SocialIcons from '@/components/SocialIcons';
import { getOptimizedImageUrl } from '@/lib/utils';

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  end_date: string | null;
  campaign_name: string | null;
  description?: string;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number | null;
}

export default function Offers() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffersData();
  }, []);

  const fetchOffersData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active coupons
      const { data: couponData, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true);
      
      if (couponError) throw couponError;

      // Filter local campaigns or map descriptions based on coupon type for cleaner display
      const mappedCoupons = (couponData || []).map(c => ({
        ...c,
        value: Number(c.value),
        min_order_amount: c.min_order_amount ? Number(c.min_order_amount) : 0,
        max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
        description: getCouponDescription(c as unknown as Coupon)
      }));
      setCoupons(mappedCoupons);

      // 2. Fetch banners for page = 'offers'
      const { data: bannerData, error: bannerError } = await supabase
        .from('banners')
        .select('*')
        .eq('page', 'offers')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (bannerError) throw bannerError;
      setBanners((bannerData as unknown as Banner[]) || []);

    } catch (err) {
      console.error('Error fetching offers:', err);
      toast.error('Failed to load active offers');
    } finally {
      setLoading(false);
    }
  };

  const getCouponDescription = (c: Coupon) => {
    const valueStr = c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`;
    const minOrderStr = c.min_order_amount && Number(c.min_order_amount) > 0 ? ` on orders above ₹${c.min_order_amount}` : '';
    
    switch (c.type) {
      case 'flat':
        return `Get flat ${valueStr} off your total order value${minOrderStr}.`;
      case 'percentage':
        return `Enjoy ${valueStr} discount on your purchase${minOrderStr}.`;
      case 'free_shipping':
        return `Get free shipping on your order${minOrderStr}.`;
      case 'first_order':
        return `Special ${valueStr} discount on your very first order${minOrderStr}!`;
      case 'bogo':
        return `Buy One Get One Free offer applicable on selected traditional mixes.`;
      default:
        return `Save big using code ${c.code}${minOrderStr}.`;
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code "${code}" copied to clipboard!`);
    
    // Log customer activity
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'coupon_used',
          description: `Copied promo code: ${code}`,
          metadata: { code }
        }).then(() => {});
      }
    });
  };

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SEOHead
        title="Active Offers & Discount Coupons | AAYISH Foods"
        description="Save on authentic pickles, sweets, and traditional delicacies. Check out active discounts, copy promo codes, and enjoy taste at reduced prices."
        keywords="Aayish coupons, discount pickle online, Indian food offers, pickle promo codes"
        url="https://www.aayishfoods.online/offers"
      />
      <SocialIcons />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-primary font-bold tracking-widest uppercase text-sm mb-2 block">Exclusive Deals</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Deals & Coupons</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full"></div>
          <p className="text-muted-foreground mt-4 text-lg">
            Apply these limited-time promotional codes on the cart page for extra savings
          </p>
        </div>

        {/* Campaign Banner Sliders */}
        {banners.length > 0 && (
          <div className="mb-12 space-y-6">
            {banners.map((banner) => (
              <a
                key={banner.id}
                href={banner.link_url || '#'}
                className="block overflow-hidden rounded-2xl border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 group"
              >
                <img
                  src={getOptimizedImageUrl(banner.image_url)}
                  alt={banner.title}
                  className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-500"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-44 bg-muted/30 border border-border/40 animate-pulse rounded-2xl"></div>
            ))}
          </div>
        ) : coupons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {coupons.map((coupon) => (
              <Card
                key={coupon.id}
                className="overflow-hidden border-2 border-dashed border-[#e5d4c0] hover:border-primary/50 bg-white/50 transition-all rounded-2xl shadow-sm"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Left Discount Ribbon */}
                  <div className="w-full sm:w-1/4 bg-primary/5 border-b sm:border-b-0 sm:border-r border-[#e5d4c0] flex flex-col items-center justify-center p-4 text-primary">
                    {coupon.type === 'percentage' ? (
                      <Percent className="h-10 w-10 stroke-1 mb-2" />
                    ) : (
                      <Ticket className="h-10 w-10 stroke-1 mb-2" />
                    )}
                    <span className="font-serif font-bold text-lg text-center">
                      {coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-accent/80 tracking-wider">OFF</span>
                  </div>

                  {/* Main Content */}
                  <CardContent className="w-full sm:w-3/4 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-serif font-bold text-xl text-foreground">
                          {coupon.campaign_name || 'Special Discount'}
                        </h3>
                        {coupon.end_date && (
                          <span className="text-[10px] bg-secondary/80 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                            Expires Soon
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                        {coupon.description}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 w-full">
                      {/* Copy Coupon Badge */}
                      <div className="flex items-center justify-center gap-2 bg-[#f5e9da] px-3.5 py-2 border border-[#e5d4c0] rounded-lg w-full sm:w-auto h-11 sm:h-9">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-mono font-bold text-primary tracking-wider text-sm select-all">
                          {coupon.code}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleCopyCode(coupon.code)}
                        className="rounded-lg bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-2 text-xs h-11 sm:h-9 w-full sm:w-auto px-4 shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-border/40 shadow-sm max-w-2xl mx-auto">
            <Gift className="h-12 w-12 mx-auto text-primary opacity-40 mb-4" />
            <h3 className="text-xl font-serif font-bold text-foreground mb-2">No Active Coupons</h3>
            <p className="text-muted-foreground">
              We are currently preparing exciting new campaigns. Check back soon for exclusive deals!
            </p>
          </div>
        )}

        {/* Security & Quality Trust banner */}
        <div className="mt-16 p-8 rounded-2xl bg-secondary/10 border border-secondary/30 text-center max-w-4xl mx-auto">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-3" />
          <h4 className="font-serif font-bold text-lg text-foreground mb-1">Aayish Foods Quality Guarantee</h4>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            All our pickles and delicacies are prepared with authentic organic ingredients, handcrafted in small batches by rural women cooperatives. 100% pure taste guaranteed.
          </p>
        </div>
      </div>
    </div>
  );
}
