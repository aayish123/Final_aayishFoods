
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import SocialIcons from '@/components/SocialIcons';
import { toast } from 'sonner';

interface Address {
  id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

const Address = () => {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { items, totalAmount } = useCart();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  useEffect(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (items.length === 0) {
      navigate('/cart');
      return;
    }
    fetchAddresses();
  }, [user, items, navigate]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      setAddresses(data || []);
      if (data && data.length > 0) {
        const defaultAddress = data.find(addr => addr.is_default);
        setSelectedAddress(defaultAddress?.id || data[0].id);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setShowNewAddressForm(true);
    setNewAddress({
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode
    });
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm('Delete this address?')) return;
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', user?.id);
    if (error) {
      toast.error('Failed to delete address');
    } else {
      toast.success('Address deleted');
      fetchAddresses();
    }
  };

  const handleSaveAddress = async () => {
    try {
      if (editingAddress) {
        // Update
        const { error } = await supabase
          .from('addresses')
          .update({ ...newAddress })
          .eq('id', editingAddress.id)
          .eq('user_id', user?.id);
        if (error) throw error;
        toast.success('Address updated successfully');
      } else {
        // Insert (existing logic)
        const { error } = await supabase
          .from('addresses')
          .insert([{
            ...newAddress,
            user_id: user?.id,
            is_default: addresses.length === 0
          }]);
        if (error) throw error;
        toast.success('Address saved successfully');
      }
      setShowNewAddressForm(false);
      setEditingAddress(null);
      setNewAddress({
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: ''
      });
      fetchAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Failed to save address');
    }
  };

  const handleProceedToPayment = () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }
    navigate('/payment', { state: { addressId: selectedAddress } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SocialIcons />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Delivery Address</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {addresses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedAddress === address.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedAddress(address.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{address.full_name}</h3>
                          <p className="text-sm text-gray-600">{address.phone}</p>
                          <p className="text-sm text-gray-600">
                            {address.address_line1}
                            {address.address_line2 && `, ${address.address_line2}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            {address.city}, {address.state} - {address.pincode}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          {address.is_default && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded mb-1">
                              Default
                            </span>
                          )}
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleEditAddress(address); }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); handleDeleteAddress(address.id); }}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {showNewAddressForm ? (
              <Card>
                <CardHeader>
                  <CardTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={newAddress.full_name}
                        onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={newAddress.address_line1}
                      onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                      placeholder="House/Flat No., Street Name"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address_line2">Address Line 2 (Optional)</Label>
                    <Input
                      id="address_line2"
                      value={newAddress.address_line2}
                      onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                      placeholder="Landmark, Area"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button onClick={handleSaveAddress}>{editingAddress ? 'Update Address' : 'Save Address'}</Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowNewAddressForm(false); setEditingAddress(null); setNewAddress({ full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '' }); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                onClick={() => { setShowNewAddressForm(true); setEditingAddress(null); setNewAddress({ full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '' }); }}
                className="w-full"
              >
                Add New Address
              </Button>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name} x {item.quantity}</span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <hr />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
                
                <Button 
                  onClick={handleProceedToPayment} 
                  className="w-full"
                  disabled={!selectedAddress}
                >
                  Proceed to Payment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Address;
