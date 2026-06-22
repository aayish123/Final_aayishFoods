import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import SocialIcons from '@/components/SocialIcons';
import { toast } from 'sonner';
import { CreditCard, Wallet, Banknote } from 'lucide-react';
import { useCheckout } from '@/shared/hooks/useCheckout';

const Payment = () => {
  const { user } = useAuth();
  const { items, totalAmount, clearCart, appliedCoupon, discountAmount, removeCoupon } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [processing, setProcessing] = useState(false);
  
  // Single-use component mount-based idempotency key
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const addressId = location.state?.addressId;
  const deliveryFee = location.state?.deliveryFee || 0;

  const checkoutMutation = useCheckout();

  if (!user || !addressId || items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handlePlaceOrder = async (isOnlinePayment: boolean = false) => {
    setProcessing(true);
    try {
      // Map items to send only variant_id and quantity (no pricing metadata)
      const itemsPayload = items.map(item => ({
        variant_id: item.variantId,
        quantity: item.quantity
      }));

      // Call secure checkout RPC
      const result = await checkoutMutation.mutateAsync({
        addressId,
        couponCode: appliedCoupon?.code || null,
        items: itemsPayload,
        paymentMethod: isOnlinePayment ? 'online' : 'cod',
        idempotencyKey
      });

      // Clear cart context
      removeCoupon();
      clearCart();

      if (result.status === 'payment_review') {
        toast.warning('Order placed. Stock was depleted during payment and is now under manual review.', { duration: 6000 });
      } else {
        toast.success('Order placed successfully!');
      }

      navigate('/orders', { state: { orderId: result.order_id } });
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const mockPaymentProcess = async () => {
    setProcessing(true);
    // Simulate online gateway processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (Math.random() > 0.1) { // 90% success rate
      await handlePlaceOrder(true);
    } else {
      toast.error('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SocialIcons />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Payment</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b border-border/40 py-6">
                <CardTitle className="font-serif text-2xl text-foreground">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-4">
                  <div className={`transition-all border-2 rounded-xl overflow-hidden ${
                    paymentMethod === 'cod' ? 'border-primary bg-primary/5 shadow-md' : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                  }`}>
                    <Label htmlFor="cod" className="flex items-center space-x-4 p-5 cursor-pointer w-full">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMethod === 'cod' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {paymentMethod === 'cod' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <RadioGroupItem value="cod" id="cod" className="sr-only" />
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                          <Banknote className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-foreground">Cash on Delivery</div>
                          <div className="text-sm text-muted-foreground">Pay when your order arrives</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className={`transition-all border-2 rounded-xl overflow-hidden ${
                    paymentMethod === 'card' ? 'border-primary bg-primary/5 shadow-md' : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                  }`}>
                    <Label htmlFor="card" className="flex items-center space-x-4 p-5 cursor-pointer w-full">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMethod === 'card' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {paymentMethod === 'card' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <RadioGroupItem value="card" id="card" className="sr-only" />
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <CreditCard className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-foreground">Credit/Debit Card</div>
                          <div className="text-sm text-muted-foreground">Secure online payment</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className={`transition-all border-2 rounded-xl overflow-hidden ${
                    paymentMethod === 'upi' ? 'border-primary bg-primary/5 shadow-md' : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                  }`}>
                    <Label htmlFor="upi" className="flex items-center space-x-4 p-5 cursor-pointer w-full">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMethod === 'upi' ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {paymentMethod === 'upi' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <RadioGroupItem value="upi" id="upi" className="sr-only" />
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                          <Wallet className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-foreground">UPI Payment</div>
                          <div className="text-sm text-muted-foreground">Pay using UPI apps</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
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
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-foreground/80">
                    <span>Subtotal</span>
                    <span className="font-medium">₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-foreground/80">
                    <span>Delivery Fee</span>
                    <span className="font-medium text-foreground">
                      {deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : 'Free'}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span className="font-medium">-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="h-px bg-border/60" />
                
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-2xl text-primary">
                    ₹{Math.max(0, totalAmount - discountAmount + deliveryFee).toFixed(2)}
                  </span>
                </div>
                
                <div className="pt-4 space-y-4">
                  <Button 
                    onClick={paymentMethod === 'cod' ? () => handlePlaceOrder(false) : mockPaymentProcess}
                    className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all"
                    disabled={processing}
                  >
                    {processing 
                      ? 'Processing...' 
                      : paymentMethod === 'cod' 
                        ? 'Place Order' 
                        : `Pay ₹${Math.max(0, totalAmount - discountAmount + deliveryFee).toFixed(2)}`
                    }
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    By placing this order, you agree to our <span className="text-primary hover:underline cursor-pointer">Terms & Conditions</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
