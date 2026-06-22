import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FoodCard from '@/components/FoodCard';
import SocialIcons from '@/components/SocialIcons';
import { toast } from 'sonner';
import { getOptimizedImageUrl } from '@/lib/utils';
import {
  ShoppingBag,
  Clock,
  Truck,
  CheckCircle2,
  Heart,
  MapPin,
  User,
  Trash2,
  Edit2,
  Package,
  Calendar,
  AlertTriangle,
  LogOut
} from 'lucide-react';

interface Address {
  id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  food_items: {
    name: string;
    image_url: string | null;
  } | null;
}

interface Order {
  id: string;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  created_at: string;
  notes: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  courier_partner: string | null;
  dispatch_date: string | null;
  addresses: Address | null;
  order_items: OrderItem[];
}

interface WishlistProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  in_stock: boolean | null;
  variants: {
    id: string;
    label: string;
    price: number;
  }[];
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('orders');
  const [profile, setProfile] = useState({ full_name: '', phone: '' });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Address list & form state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressInput, setAddressInput] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: ''
  });

  // Orders list state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Wishlist list state
  const [wishlistItems, setWishlistItems] = useState<WishlistProduct[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      openAuthModal();
    }
  }, [user, authLoading, openAuthModal]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAddresses();
      fetchOrders();
      fetchWishlist();

      // Realtime subscription for orders
      const orderChannel = supabase
        .channel('dashboard-orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
          () => fetchOrders()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
      };
    }
  }, [user]);

  // Profile functions
  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setProfile({
          full_name: data.full_name || '',
          phone: data.phone || ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      await supabase.from('customer_activity').insert({
        customer_id: user.id,
        activity_type: 'profile_updated',
        description: 'Updated profile information (name and phone)',
        metadata: { ...profile }
      });

      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Addresses functions
  const fetchAddresses = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setShowAddressForm(true);
    setAddressInput({
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
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this address?')) return;

    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await supabase.from('customer_activity').insert({
        customer_id: user.id,
        activity_type: 'profile_updated',
        description: 'Deleted delivery address',
        metadata: { address_id: id }
      });

      toast.success('Address deleted');
      fetchAddresses();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete address');
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingAddress) {
        const { error } = await supabase
          .from('addresses')
          .update({ ...addressInput })
          .eq('id', editingAddress.id)
          .eq('user_id', user.id);

        if (error) throw error;

        await supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'profile_updated',
          description: 'Updated delivery address details',
          metadata: { address_id: editingAddress.id, ...addressInput }
        });

        toast.success('Address updated successfully');
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert([{
            ...addressInput,
            user_id: user.id,
            is_default: addresses.length === 0
          }]);

        if (error) throw error;

        await supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'profile_updated',
          description: 'Added new delivery address',
          metadata: { ...addressInput }
        });

        toast.success('Address added successfully');
      }

      setShowAddressForm(false);
      setEditingAddress(null);
      setAddressInput({
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: ''
      });
      fetchAddresses();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save address');
    }
  };

  // Orders functions
  const fetchOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          addresses (
            id,
            full_name,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            pincode,
            is_default
          ),
          order_items (
            id,
            quantity,
            unit_price,
            food_items (
              name,
              image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as unknown as Order[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Wishlist functions
  const fetchWishlist = async () => {
    if (!user) return;
    setWishlistLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          food_items (
            id,
            name,
            description,
            image_url,
            category,
            in_stock,
            food_item_variants (
              id,
              label,
              price
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      interface DbWishlistRow {
        food_items: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          category: string | null;
          in_stock: boolean | null;
          food_item_variants: {
            id: string;
            label: string;
            price: number;
          }[];
        } | null;
      }

      const products = (data as unknown as DbWishlistRow[] || [])
        .map((row) => row.food_items)
        .filter((fi): fi is NonNullable<typeof fi> => fi !== null)
        .map((fi) => ({
          id: fi.id,
          name: fi.name,
          description: fi.description,
          image_url: fi.image_url,
          category: fi.category,
          in_stock: fi.in_stock,
          variants: (fi.food_item_variants || []).map((v) => ({
            id: v.id,
            label: v.label,
            price: Number(v.price)
          }))
        }));

      setItems(products); // Sets internal component state
      setWishlistItems(products);
    } catch (err) {
      console.error(err);
    } finally {
      setWishlistLoading(false);
    }
  };

  const [_, setItems] = useState<WishlistProduct[]>([]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FDF8F0] pt-10 pb-24">
      <SocialIcons />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center md:text-left">
          <span className="text-primary font-bold tracking-widest uppercase text-xs mb-2 block">Account Dashboard</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground">
            Vanakkam, <span className="text-primary">{profile.full_name || user.user_metadata?.full_name || 'Food Lover'}</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
            Track orders, manage your wishlist, update delivery address books, and modify personal settings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white border border-[#e5d4c0] p-1 rounded-xl w-full md:w-auto grid grid-cols-4 md:flex gap-1">
            <TabsTrigger value="orders" className="rounded-lg py-2.5 font-medium font-serif flex items-center justify-center gap-2 text-xs md:text-sm">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden md:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="rounded-lg py-2.5 font-medium font-serif flex items-center justify-center gap-2 text-xs md:text-sm">
              <Heart className="h-4 w-4" />
              <span className="hidden md:inline">Wishlist</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="rounded-lg py-2.5 font-medium font-serif flex items-center justify-center gap-2 text-xs md:text-sm">
              <MapPin className="h-4 w-4" />
              <span className="hidden md:inline">Addresses</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-lg py-2.5 font-medium font-serif flex items-center justify-center gap-2 text-xs md:text-sm">
              <User className="h-4 w-4" />
              <span className="hidden md:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          {/* 1. ORDERS TAB */}
          <TabsContent value="orders" className="space-y-6">
            {ordersLoading ? (
              <div className="space-y-4 animate-pulse">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-48 bg-white border border-[#e5d4c0] rounded-2xl"></div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <Card className="border border-[#e5d4c0] rounded-2xl bg-white shadow-sm">
                <CardContent className="p-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-serif font-bold text-xl text-foreground mb-2">No Orders Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                    Looks like you haven't ordered any traditional treats yet. Head over to our catalog to make your first purchase!
                  </p>
                  <Button onClick={() => navigate('/menu')} className="rounded-full px-6 font-semibold">
                    Browse Pickles & Sweets
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => {
                  const isCancelled = order.status === 'cancelled';
                  
                  // Progress tracker helper variables
                  const isConfirmed = order.status && ['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status);
                  const isPacked = order.packed_at !== null || (order.status && ['preparing', 'out_for_delivery', 'delivered'].includes(order.status));
                  const isShipped = order.shipped_at !== null || (order.status && ['out_for_delivery', 'delivered'].includes(order.status));
                  const isDelivered = order.delivered_at !== null || order.status === 'delivered';

                  return (
                    <Card key={order.id} className="border border-[#e5d4c0] rounded-2xl bg-white shadow-sm overflow-hidden">
                      {/* Order Info Header */}
                      <div className="bg-[#fcf8f2] border-b border-[#e5d4c0] p-5 flex flex-col md:flex-row justify-between gap-4">
                        <div className="grid grid-cols-2 md:flex gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">Order ID</p>
                            <p className="font-mono font-semibold text-foreground text-xs mt-1">{order.id}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">Date Placed</p>
                            <p className="font-semibold text-foreground mt-1">
                              {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider">Grand Total</p>
                            <p className="font-bold text-primary text-base mt-0.5">₹{Number(order.total_amount).toFixed(2)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full ${
                            isCancelled 
                              ? 'bg-red-50 text-red-600 border border-red-200' 
                              : isDelivered 
                                ? 'bg-green-50 text-green-600 border border-green-200' 
                                : 'bg-primary/5 text-primary border border-primary/20'
                          }`}>
                            {order.status}
                          </span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full ${
                            order.payment_status === 'completed'
                              ? 'bg-green-50 text-green-600 border border-green-200'
                              : order.payment_status === 'failed'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-orange-50 text-orange-600 border border-orange-200'
                          }`}>
                            Pay: {order.payment_status}
                          </span>
                        </div>
                      </div>

                      {/* Items & Stepper Grid */}
                      <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Column 1 & 2: Items & Tracking Details */}
                        <div className="lg:col-span-2 space-y-6">
                          <div className="divide-y divide-border/40">
                            {order.order_items.map((item) => (
                              <div key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                                <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden border border-[#e5d4c0] shrink-0">
                                  <img
                                    src={getOptimizedImageUrl(item.food_items?.image_url)}
                                    alt={item.food_items?.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-foreground text-sm truncate">{item.food_items?.name}</p>
                                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                </div>
                                <span className="font-bold text-sm text-foreground">₹{Number(item.unit_price).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Courier Dispatch details */}
                          {(order.tracking_number || order.courier_partner) && (
                            <div className="bg-[#fcf8f2] border border-[#e5d4c0] p-4 rounded-xl space-y-2">
                              <h4 className="text-xs uppercase font-bold text-foreground tracking-wider flex items-center gap-1.5">
                                <Truck className="h-4 w-4 text-primary" />
                                Shipping Information
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Partner:</span>{' '}
                                  <span className="font-semibold text-foreground">{order.courier_partner || 'Courier Partner'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Tracking ID:</span>{' '}
                                  <span className="font-mono font-semibold text-primary select-all">{order.tracking_number || 'Pending'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Dispatch Date:</span>{' '}
                                  <span className="font-semibold text-foreground">
                                    {order.dispatch_date 
                                      ? new Date(order.dispatch_date).toLocaleDateString()
                                      : 'Preparing'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column 3: Live Progress Tracker */}
                        <div className="bg-white lg:border-l lg:border-[#e5d4c0]/60 lg:pl-8 flex flex-col justify-center">
                          {isCancelled ? (
                            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                              <AlertTriangle className="h-5 w-5 shrink-0" />
                              <div>
                                <p className="font-bold">Order Cancelled</p>
                                <p className="mt-0.5 text-red-600/95">This order is cancelled and will not be processed.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-6 relative">
                              {/* Connector line */}
                              <div className="absolute left-4 top-1 bottom-1 w-0.5 bg-gray-200 -z-10"></div>
                              
                              {/* Step 1: Confirmed */}
                              <div className="flex items-start gap-4">
                                <div className={`h-8.5 w-8.5 rounded-full flex items-center justify-center border text-xs font-bold transition-colors ${
                                  isConfirmed
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white border-gray-300 text-muted-foreground'
                                }`}>
                                  {isConfirmed ? <CheckCircle2 className="h-5 w-5" /> : '1'}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">Confirmed</p>
                                  <p className="text-[11px] text-muted-foreground">Order has been verified</p>
                                </div>
                              </div>

                              {/* Step 2: Packed */}
                              <div className="flex items-start gap-4">
                                <div className={`h-8.5 w-8.5 rounded-full flex items-center justify-center border text-xs font-bold transition-colors ${
                                  isPacked
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white border-gray-300 text-muted-foreground'
                                }`}>
                                  {isPacked ? <CheckCircle2 className="h-5 w-5" /> : '2'}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">Packed</p>
                                  <p className="text-[11px] text-muted-foreground">Ingredients boxed and ready</p>
                                </div>
                              </div>

                              {/* Step 3: Shipped */}
                              <div className="flex items-start gap-4">
                                <div className={`h-8.5 w-8.5 rounded-full flex items-center justify-center border text-xs font-bold transition-colors ${
                                  isShipped
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white border-gray-300 text-muted-foreground'
                                }`}>
                                  {isShipped ? <CheckCircle2 className="h-5 w-5" /> : '3'}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">Shipped</p>
                                  <p className="text-[11px] text-muted-foreground">In transit with courier</p>
                                </div>
                              </div>

                              {/* Step 4: Delivered */}
                              <div className="flex items-start gap-4">
                                <div className={`h-8.5 w-8.5 rounded-full flex items-center justify-center border text-xs font-bold transition-colors ${
                                  isDelivered
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white border-gray-300 text-muted-foreground'
                                }`}>
                                  {isDelivered ? <CheckCircle2 className="h-5 w-5" /> : '4'}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">Delivered</p>
                                  <p className="text-[11px] text-muted-foreground">Enjoy your fresh food</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* 2. WISHLIST TAB */}
          <TabsContent value="wishlist">
            {wishlistLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-72 bg-white border border-[#e5d4c0] rounded-2xl"></div>
                ))}
              </div>
            ) : wishlistItems.length === 0 ? (
              <Card className="border border-[#e5d4c0] rounded-2xl bg-white shadow-sm">
                <CardContent className="p-12 text-center">
                  <Heart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="font-serif font-bold text-xl text-foreground mb-2">Wishlist is Empty</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                    Keep track of items you love by adding them to your wishlist.
                  </p>
                  <Button onClick={() => navigate('/menu')} className="rounded-full px-6 font-semibold">
                    Browse Shop Catalog
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
                {wishlistItems.map((product) => (
                  <FoodCard key={product.id} item={product} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 3. ADDRESSES TAB */}
          <TabsContent value="addresses" className="space-y-6">
            {showAddressForm ? (
              <Card className="border border-[#e5d4c0] rounded-2xl bg-white shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                <CardHeader className="bg-[#fcf8f2] border-b border-[#e5d4c0] py-5">
                  <CardTitle className="font-serif text-xl text-foreground">
                    {editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                  </CardTitle>
                  <CardDescription className="text-xs">Specify coordinates for quick Courier delivery</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSaveAddress} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Full Name</Label>
                        <Input
                          id="full_name"
                          value={addressInput.full_name}
                          onChange={(e) => setAddressInput({ ...addressInput, full_name: e.target.value })}
                          className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={addressInput.phone}
                          onChange={(e) => setAddressInput({ ...addressInput, phone: e.target.value })}
                          className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address_line1" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Address Line 1</Label>
                      <Input
                        id="address_line1"
                        value={addressInput.address_line1}
                        onChange={(e) => setAddressInput({ ...addressInput, address_line1: e.target.value })}
                        placeholder="Flat No., House Name, Street"
                        className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address_line2" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Address Line 2 (Optional)</Label>
                      <Input
                        id="address_line2"
                        value={addressInput.address_line2}
                        onChange={(e) => setAddressInput({ ...addressInput, address_line2: e.target.value })}
                        placeholder="Landmark, Area info"
                        className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="city" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">City</Label>
                        <Input
                          id="city"
                          value={addressInput.city}
                          onChange={(e) => setAddressInput({ ...addressInput, city: e.target.value })}
                          className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="state" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">State</Label>
                        <Input
                          id="state"
                          value={addressInput.state}
                          onChange={(e) => setAddressInput({ ...addressInput, state: e.target.value })}
                          className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pincode" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Pincode</Label>
                        <Input
                          id="pincode"
                          value={addressInput.pincode}
                          onChange={(e) => setAddressInput({ ...addressInput, pincode: e.target.value })}
                          className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-3">
                      <Button type="submit" className="rounded-lg h-11 px-6 font-semibold shadow-sm">
                        {editingAddress ? 'Update Address' : 'Save Address'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg h-11 px-6 border-border/60 hover:bg-secondary/20"
                        onClick={() => {
                          setShowAddressForm(false);
                          setEditingAddress(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-serif font-bold text-xl text-foreground">Delivery Addresses</h3>
                  <Button 
                    variant="outline" 
                    className="border-[#e5d4c0] hover:bg-primary/5 hover:text-primary rounded-xl h-11 px-4"
                    onClick={() => {
                      setEditingAddress(null);
                      setShowAddressForm(true);
                      setAddressInput({
                        full_name: '',
                        phone: '',
                        address_line1: '',
                        address_line2: '',
                        city: '',
                        state: '',
                        pincode: ''
                      });
                    }}
                  >
                    + Add New Address
                  </Button>
                </div>

                {addresses.length === 0 ? (
                  <Card className="border border-[#e5d4c0] rounded-2xl bg-white p-8 text-center text-muted-foreground text-sm">
                    No addresses stored yet. Add an address to enable faster checkout.
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {addresses.map((address) => (
                      <Card key={address.id} className="border border-[#e5d4c0] rounded-2xl bg-white shadow-sm hover:shadow-md transition-all">
                        <CardContent className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-foreground text-lg">{address.full_name}</h4>
                                {address.is_default && (
                                  <span className="text-[9px] uppercase tracking-wider bg-secondary/80 text-primary px-2 py-0.5 rounded-full font-bold">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-medium">{address.phone}</p>
                            </div>
                            
                            <div className="flex gap-1.5">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => handleEditAddress(address)}
                                className="h-11 w-11 sm:h-8 sm:w-8 hover:bg-[#FDF8F0] text-muted-foreground hover:text-primary rounded-lg flex items-center justify-center"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => handleDeleteAddress(address.id)}
                                className="h-11 w-11 sm:h-8 sm:w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg flex items-center justify-center"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="text-sm text-foreground/80 leading-relaxed space-y-0.5">
                            <p>{address.address_line1}</p>
                            {address.address_line2 && <p>{address.address_line2}</p>}
                            <p>{address.city}, {address.state} - <span className="font-semibold">{address.pincode}</span></p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* 4. PROFILE TAB */}
          <TabsContent value="profile">
            <Card className="border border-[#e5d4c0] rounded-2xl bg-white shadow-sm overflow-hidden max-w-2xl mx-auto">
              <CardHeader className="bg-[#fcf8f2] border-b border-[#e5d4c0] py-5">
                <CardTitle className="font-serif text-xl text-foreground">Edit Profile Information</CardTitle>
                <CardDescription className="text-xs">Update your checkout default phone and full name details</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof_full_name" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Full Name</Label>
                    <Input
                      id="prof_full_name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prof_phone" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Phone Number</Label>
                    <Input
                      id="prof_phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="h-11 rounded-lg bg-muted/20 border-border/60 focus-visible:ring-primary focus-visible:border-primary"
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <Button type="submit" disabled={updatingProfile} className="rounded-lg h-11 px-8 font-semibold shadow-sm w-full sm:w-auto">
                      {updatingProfile ? 'Saving...' : 'Save Profile Details'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
