
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

const Cart = () => {
  const { items, updateQuantity, removeItem, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');

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
      <div className="min-h-screen bg-gray-50">
        <SocialIcons />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Cart</h1>
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg mb-4">Your cart is empty</p>
              <Button onClick={() => navigate('/menu')}>
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SocialIcons />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Cart Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div key={item.id + '-' + item.variantId} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <img
                      src={item.image_url || '/placeholder.svg'}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      <div className="text-xs text-gray-500 mb-1">{item.variantLabel}</div>
                      <p className="text-orange-600 font-medium">₹{item.price}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1, item.variantId)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1, item.variantId)}
                        className="w-16 text-center"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1, item.variantId)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(item.id, item.variantId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
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
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Order Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions..."
                    className="w-full p-2 border rounded-md resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Button onClick={handleProceedToCheckout} className="w-full">
                    Proceed to Checkout
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/menu')}
                    className="w-full"
                  >
                    Continue Shopping
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    className="w-full text-red-600 hover:text-red-700"
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
