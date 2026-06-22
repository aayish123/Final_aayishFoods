
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
  const { items, totalAmount, appliedCoupon, discountAmount } = useCart();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deliveryFees, setDeliveryFees] = useState<Record<string, number>>({});
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

  const calculateDeliveryFees = async (addrList: Address[]) => {
    if (addrList.length === 0) return;
    
    let defaultFee = 60;
    try {
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('category', 'shipping')
        .maybeSingle();
      
      if (settingsData && settingsData.value) {
        const val = settingsData.value as { deliveryFee?: number };
        if (val.deliveryFee !== undefined) {
          defaultFee = Number(val.deliveryFee);
        }
      }
    } catch (err) {
      console.error('Error fetching shipping settings:', err);
    }

    const fees: Record<string, number> = {};
    for (const addr of addrList) {
      try {
        const { data: zone } = await supabase
          .from('delivery_zones')
          .select('delivery_charge, is_active')
          .eq('pincode', addr.pincode.trim())
          .eq('is_active', true)
          .maybeSingle();

        if (zone) {
          fees[addr.id] = Number(zone.delivery_charge);
        } else {
          fees[addr.id] = defaultFee;
        }
      } catch (err) {
        console.error('Error fetching zone for address:', addr.id, err);
        fees[addr.id] = defaultFee;
      }
    }
    setDeliveryFees(fees);
  };

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
      await calculateDeliveryFees(data || []);
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
    const deliveryFee = deliveryFees[selectedAddress] || 0;
    navigate('/payment', { state: { addressId: selectedAddress, deliveryFee } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SocialIcons />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Delivery Address</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-2 space-y-8">
            {addresses.length > 0 && (
              <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden">
                <CardHeader className="bg-secondary/10 border-b border-border/40 py-6">
                  <CardTitle className="font-serif text-2xl text-foreground">Select Address</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`p-5 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedAddress === address.id
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                      }`}
                      onClick={() => setSelectedAddress(address.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start space-x-3">
                          <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                            selectedAddress === address.id ? 'border-primary' : 'border-muted-foreground'
                          }`}>
                            {selectedAddress === address.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <div className="flex items-center space-x-3 mb-1">
                              <h3 className="font-semibold text-lg text-foreground">{address.full_name}</h3>
                              {address.is_default && (
                                <span className="text-[10px] uppercase tracking-wider bg-secondary/80 text-primary px-2 py-0.5 rounded-full font-bold">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{address.phone}</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              {address.address_line1}
                              {address.address_line2 && `, ${address.address_line2}`}
                            </p>
                            <p className="text-sm text-foreground/80">
                              {address.city}, {address.state} - <span className="font-medium">{address.pincode}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-col sm:items-end justify-end ml-8 sm:ml-0">
                          <Button size="sm" variant="ghost" className="h-8 hover:bg-white hover:text-primary transition-all text-muted-foreground" onClick={e => { e.stopPropagation(); handleEditAddress(address); }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="h-8 hover:bg-destructive/10 hover:text-destructive transition-all text-muted-foreground" onClick={e => { e.stopPropagation(); handleDeleteAddress(address.id); }}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {showNewAddressForm ? (
              <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="bg-secondary/10 border-b border-border/40 py-6">
                  <CardTitle className="font-serif text-2xl text-foreground">{editingAddress ? 'Edit Address' : 'Add New Address'}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Full Name</Label>
                      <Input
                        id="full_name"
                        value={newAddress.full_name}
                        onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                        className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_line1" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={newAddress.address_line1}
                      onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                      placeholder="House/Flat No., Street Name"
                      className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_line2" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Address Line 2 <span className="normal-case font-normal text-muted-foreground">(Optional)</span></Label>
                    <Input
                      id="address_line2"
                      value={newAddress.address_line2}
                      onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                      placeholder="Landmark, Area"
                      className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">City</Label>
                      <Input
                        id="city"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">State</Label>
                      <Input
                        id="state"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Pincode</Label>
                      <Input
                        id="pincode"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                        className="h-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                    <Button onClick={handleSaveAddress} className="h-12 rounded-xl px-8 flex-1 sm:flex-none">
                      {editingAddress ? 'Update Address' : 'Save Address'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 rounded-xl px-8 flex-1 sm:flex-none hover:bg-secondary/20"
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
                className="w-full h-16 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all text-muted-foreground font-semibold text-lg"
              >
                + Add New Address
              </Button>
            )}
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
                      {selectedAddress && deliveryFees[selectedAddress] !== undefined
                        ? `₹${deliveryFees[selectedAddress].toFixed(2)}`
                        : 'Calculated at payment'}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span>- ₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="h-px bg-border/60" />
                
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-2xl text-primary">
                    ₹{(
                      totalAmount - 
                      discountAmount + 
                      (selectedAddress && deliveryFees[selectedAddress] !== undefined ? deliveryFees[selectedAddress] : 0)
                    ).toFixed(2)}
                  </span>
                </div>
                
                <div className="pt-4">
                  <Button 
                    onClick={handleProceedToPayment} 
                    className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all"
                    disabled={!selectedAddress || addresses.length === 0}
                  >
                    Proceed to Payment
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

export default Address;
