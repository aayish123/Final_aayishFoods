
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import SocialIcons from '@/components/SocialIcons';
import { toast } from 'sonner';
import { CreditCard, Wallet, Banknote } from 'lucide-react';

const Payment = () => {
  const { user } = useAuth();
  const { items, totalAmount, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [processing, setProcessing] = useState(false);
  
  const addressId = location.state?.addressId;

  if (!user || !addressId || items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handlePlaceOrder = async () => {
    setProcessing(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: user.id,
          address_id: addressId,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: paymentMethod === 'cod' ? 'pending' : 'completed'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        food_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart and redirect
      clearCart();
      toast.success('Order placed successfully!');
      navigate('/orders', { state: { orderId: order.id } });
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const mockPaymentProcess = async () => {
    // Simulate payment processing
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (Math.random() > 0.1) { // 90% success rate
      await handlePlaceOrder();
    } else {
      toast.error('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SocialIcons />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Payment</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <RadioGroupItem value="cod" id="cod" />
                    <Label htmlFor="cod" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <Banknote className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium">Cash on Delivery</div>
                        <div className="text-sm text-gray-500">Pay when your order arrives</div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">Credit/Debit Card</div>
                        <div className="text-sm text-gray-500">Secure online payment</div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="flex items-center space-x-3 cursor-pointer flex-1">
                      <Wallet className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-medium">UPI Payment</div>
                        <div className="text-sm text-gray-500">Pay using UPI apps</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id + '-' + item.variantId} className="flex justify-between text-sm">
                      <span>{item.name} ({item.variantLabel}) x {item.quantity}</span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                
                <hr />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-₹0.00</span>
                  </div>
                </div>
                
                <hr />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
                
                <Button 
                  onClick={paymentMethod === 'cod' ? handlePlaceOrder : mockPaymentProcess}
                  className="w-full"
                  disabled={processing}
                >
                  {processing 
                    ? 'Processing...' 
                    : paymentMethod === 'cod' 
                      ? 'Place Order' 
                      : `Pay ₹${totalAmount.toFixed(2)}`
                  }
                </Button>
                
                <p className="text-xs text-gray-500 text-center">
                  By placing this order, you agree to our Terms & Conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
