
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  variantId: string;
  variantLabel: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'flat' | 'percentage' | 'free_shipping' | 'first_order' | 'bogo';
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string, variantId: string) => void;
  updateQuantity: (id: string, quantity: number, variantId: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  appliedCoupon: Coupon | null;
  discountAmount: number;
  applyCouponCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // Sync / Load database cart when user status changes
  useEffect(() => {
    const syncDatabaseCart = async () => {
      if (user) {
        try {
          // 1. Get guest items from localStorage or state
          const savedGuestCart = localStorage.getItem('aayish_cart');
          const guestItems: CartItem[] = savedGuestCart ? JSON.parse(savedGuestCart) : [];

          if (guestItems.length > 0) {
            // Merge guest items to DB
            for (const item of guestItems) {
              const { data: existing } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('food_item_id', item.id)
                .eq('variant_id', item.variantId)
                .maybeSingle();

              if (existing) {
                const newQty = existing.quantity + item.quantity;
                await supabase
                  .from('cart_items')
                  .update({ quantity: newQty })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('cart_items')
                  .insert({
                    user_id: user.id,
                    food_item_id: item.id,
                    variant_id: item.variantId,
                    quantity: item.quantity
                  });
              }
            }
            // Clear guest cart from localStorage
            localStorage.removeItem('aayish_cart');
          }

          // 2. Fetch all cart items from DB
          const { data, error } = await supabase
            .from('cart_items')
            .select(`
              quantity,
              food_item_id,
              variant_id,
              food_items (
                name,
                image_url
              ),
              food_item_variants (
                label,
                price
              )
            `)
            .eq('user_id', user.id);

          if (!error && data) {
            interface DbCartRow {
              quantity: number;
              food_item_id: string;
              variant_id: string;
              food_items: { name: string; image_url: string | null } | null;
              food_item_variants: { label: string; price: number } | null;
            }
            const dbItems: CartItem[] = (data as unknown as DbCartRow[]).map((row) => ({
              id: row.food_item_id,
              name: row.food_items?.name || '',
              price: Number(row.food_item_variants?.price || 0),
              quantity: row.quantity,
              image_url: row.food_items?.image_url || undefined,
              variantId: row.variant_id,
              variantLabel: row.food_item_variants?.label || ''
            }));
            setItems(dbItems);
          }
        } catch (err) {
          console.error('Error syncing database cart:', err);
        }
      } else {
        // Load guest cart
        const saved = localStorage.getItem('aayish_cart');
        setItems(saved ? JSON.parse(saved) : []);
      }
    };

    syncDatabaseCart();
  }, [user]);

  // Sync anonymous/guest cart to localStorage when items update and user is not logged in
  useEffect(() => {
    if (!user) {
      localStorage.setItem('aayish_cart', JSON.stringify(items));
    } else {
      localStorage.removeItem('aayish_cart');
    }
  }, [items, user]);

  const addItem = async (newItem: Omit<CartItem, 'quantity'>) => {
    // 1. Update local state
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === newItem.id && item.variantId === newItem.variantId);
      if (existingItem) {
        return prevItems.map(item =>
          item.id === newItem.id && item.variantId === newItem.variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevItems, { ...newItem, quantity: 1 }];
      }
    });

    // 2. Update DB if authenticated
    if (user) {
      try {
        const { data: existing } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('food_item_id', newItem.id)
          .eq('variant_id', newItem.variantId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + 1 })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              food_item_id: newItem.id,
              variant_id: newItem.variantId,
              quantity: 1
            });
        }
      } catch (err) {
        console.error('Error adding to database cart:', err);
      }
    }
  };

  const removeItem = async (id: string, variantId: string) => {
    setItems(prevItems => prevItems.filter(item => !(item.id === id && item.variantId === variantId)));

    if (user) {
      try {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id)
          .eq('food_item_id', id)
          .eq('variant_id', variantId);
      } catch (err) {
        console.error('Error removing from database cart:', err);
      }
    }
  };

  const updateQuantity = async (id: string, quantity: number, variantId: string) => {
    if (quantity <= 0) {
      await removeItem(id, variantId);
      return;
    }
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id && item.variantId === variantId ? { ...item, quantity } : item
      )
    );

    if (user) {
      try {
        await supabase
          .from('cart_items')
          .upsert({
            user_id: user.id,
            food_item_id: id,
            variant_id: variantId,
            quantity: quantity,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,food_item_id,variant_id' });
      } catch (err) {
        console.error('Error updating quantity in database cart:', err);
      }
    }
  };

  const clearCart = async () => {
    setItems([]);
    if (user) {
      try {
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Error clearing database cart:', err);
      }
    }
  };

  const applyCouponCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return { success: false, message: 'Invalid or inactive coupon code' };
      }

      // Check date
      if (data.end_date && new Date(data.end_date) < new Date()) {
        return { success: false, message: 'Coupon code has expired' };
      }

      // Check min order amount
      const minAmount = data.min_order_amount ? Number(data.min_order_amount) : 0;
      if (totalAmount < minAmount) {
        return { success: false, message: `Minimum order of ₹${minAmount} required to apply this coupon` };
      }

      // Apply it
      const coupon: Coupon = {
        id: data.id,
        code: data.code,
        type: data.type as Coupon['type'],
        value: Number(data.value),
        min_order_amount: data.min_order_amount ? Number(data.min_order_amount) : null,
        max_discount_amount: data.max_discount_amount ? Number(data.max_discount_amount) : null
      };

      setAppliedCoupon(coupon);
      
      // Log customer activity
      if (user) {
        await supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'coupon_applied',
          description: `Applied coupon code: ${coupon.code}`,
          metadata: { code: coupon.code, discount_type: coupon.type, value: coupon.value }
        });
      }

      return { success: true, message: 'Coupon applied successfully!' };
    } catch (err) {
      console.error('Error applying coupon:', err);
      return { success: false, message: 'Failed to validate coupon code' };
    }
  };

  const removeCoupon = async () => {
    const code = appliedCoupon?.code;
    setAppliedCoupon(null);
    if (user && code) {
      try {
        await supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'coupon_removed',
          description: `Removed coupon code: ${code}`,
          metadata: { code }
        });
      } catch (err) {
        console.error('Error logging coupon removal:', err);
      }
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    // Check min order amount constraint
    if (appliedCoupon.min_order_amount && totalAmount < appliedCoupon.min_order_amount) {
      return 0; // Coupon not applicable due to min order amount
    }

    if (appliedCoupon.type === 'percentage') {
      const discount = (totalAmount * appliedCoupon.value) / 100;
      if (appliedCoupon.max_discount_amount) {
        return Math.min(discount, appliedCoupon.max_discount_amount);
      }
      return discount;
    } else if (appliedCoupon.type === 'flat') {
      return Math.min(appliedCoupon.value, totalAmount);
    }
    
    return 0; // Free shipping or others handled separately or ₹0 discount here
  };

  const discountAmount = calculateDiscount();

  // Reset coupon if totalAmount drops to 0 or cart becomes empty
  useEffect(() => {
    if (items.length === 0 && appliedCoupon) {
      setAppliedCoupon(null);
    }
  }, [items, appliedCoupon]);

  const value = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalAmount,
    appliedCoupon,
    discountAmount,
    applyCouponCode,
    removeCoupon
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
