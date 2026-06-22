
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Minus } from 'lucide-react';
import SocialIcons from '@/components/SocialIcons';
import { toast } from 'sonner';
import { getOptimizedImageUrl } from '@/lib/utils';

const Cart = () => {
  const { 
    items, 
    updateQuantity, 
    removeItem, 
    totalAmount, 
    clearCart,
    appliedCoupon,
    discountAmount,
    applyCouponCode,
    removeCoupon
  } = useCart();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    const res = await applyCouponCode(couponInput);
    if (res.success) {
      toast.success(res.message);
      setCouponInput('');
    } else {
      toast.error(res.message);
    }
  };

  if (!user) {
    openAuthModal();
    return null;
  }

  const handleQuantityChange = (id: string, newQuantity: number, variantId: string) => {
    if (newQuantity < 1) {
      removeItem(id, variantId);
    } else {
      updateQuantity(id, newQuantity, variantId);
    }
  };

  const handleProceedToCheckout = () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    navigate('/address');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pt-10 pb-24">
        <SocialIcons />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Your Cart</h1>
            <div className="w-24 h-1 bg-secondary mx-auto rounded-full mb-6"></div>
          </div>
          <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 mx-auto bg-secondary/30 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="h-10 w-10 text-primary opacity-50" />
              </div>
              <p className="text-muted-foreground text-xl mb-8 font-medium">Your cart is currently empty</p>
              <Button onClick={() => navigate('/menu')} size="lg" className="rounded-full px-8 shadow-md">
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SocialIcons />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Your Cart</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/40 py-6">
                <CardTitle className="font-serif text-2xl text-foreground">Cart Items ({items.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/40">
                {items.map((item) => (
                  <div key={item.id + '-' + item.variantId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center space-x-4 w-full sm:w-auto">
                      <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden bg-muted border border-border/50 shrink-0">
                        <img
                          src={getOptimizedImageUrl(item.image_url)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg text-foreground truncate">{item.name}</h3>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 sm:mb-2">{item.variantLabel}</div>
                        <p className="text-primary font-bold text-base sm:text-lg">₹{item.price}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
                      <div className="flex items-center space-x-2 bg-white border border-border/60 rounded-lg p-1 shadow-sm">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1, item.variantId)}
                          className="h-11 w-11 sm:h-8 sm:w-8 rounded-md hover:bg-secondary/50 hover:text-primary transition-all flex items-center justify-center shrink-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1, item.variantId)}
                          className="w-10 sm:w-12 h-8 text-center border-0 focus-visible:ring-0 p-0 font-semibold text-sm"
                          min="1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1, item.variantId)}
                          className="h-11 w-11 sm:h-8 sm:w-8 rounded-md hover:bg-secondary/50 hover:text-primary transition-all flex items-center justify-center shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id, item.variantId)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-3 h-11 sm:h-8 transition-colors rounded-lg flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span className="text-xs font-medium uppercase">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden sticky top-24">
              <CardHeader className="bg-secondary/10 border-b border-border/40 py-6">
                <CardTitle className="font-serif text-2xl text-foreground">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id + '-' + item.variantId} className="flex justify-between text-sm text-foreground/80">
                      <span className="truncate pr-4 flex-1">{item.name} <span className="text-muted-foreground">({item.variantLabel})</span> x {item.quantity}</span>
                      <span className="font-medium shrink-0">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="h-px bg-border/60" />
                
                {/* Coupon Application Box */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Promo Code</label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-3.5 rounded-xl">
                      <div>
                        <p className="font-mono font-bold text-primary tracking-wider text-sm">{appliedCoupon.code}</p>
                        <p className="text-[11px] text-muted-foreground">Coupon applied successfully</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeCoupon}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 text-xs font-semibold px-2.5 rounded-lg"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Enter coupon code"
                        className="h-11 rounded-xl text-sm border-border/60"
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        className="h-11 rounded-xl font-semibold px-5"
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </div>

                <div className="h-px bg-border/60" />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">₹{totalAmount.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>- ₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <span className="font-semibold text-foreground">Grand Total</span>
                    <span className="font-bold text-2xl text-primary">
                      ₹{Math.max(0, totalAmount - discountAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <label className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Order Notes <span className="text-muted-foreground font-normal lowercase">(Optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions for your order..."
                    className="w-full p-3 border border-border/60 rounded-xl resize-none bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                    rows={3}
                  />
                </div>

                <div className="space-y-3 pt-4">
                  <Button onClick={handleProceedToCheckout} className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all">
                    Proceed to Checkout
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/menu')}
                    className="w-full h-12 rounded-xl border-2 hover:bg-secondary/20 transition-all"
                  >
                    Continue Shopping
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={clearCart}
                    className="w-full h-12 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                  >
                    Clear Cart
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
