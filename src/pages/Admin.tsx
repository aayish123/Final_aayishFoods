import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, Package, Truck, CheckCircle, Users, ShoppingBag, TrendingUp, LogOut, Plus, Edit, Trash2, RefreshCw, Settings } from 'lucide-react';

interface Order {
  id: string;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  user_id: string | null;
  addresses: {
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    food_items: {
      name: string;
      image_url: string;
    };
  }[];
}

interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  in_stock: boolean;
  image_url: string;
}

interface FoodItemVariant {
  id: string;
  food_item_id: string;
  label: string;
  price: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [variants, setVariants] = useState<FoodItemVariant[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    ongoingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: ''
  });
  
  // Variants management state
  const [isAddVariantDialogOpen, setIsAddVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<FoodItemVariant | null>(null);
  const [selectedFoodItemForVariants, setSelectedFoodItemForVariants] = useState<FoodItem | null>(null);
  const [newVariant, setNewVariant] = useState({
    label: '',
    price: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchFoodItems();
    fetchVariants();
    fetchStats();
    
    // Set up real-time subscription for ALL orders (not just admin orders)
    const ordersChannel = supabase
      .channel('admin-all-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change detected in admin:', payload);
          // Refresh data immediately when changes occur
          fetchOrders();
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        (payload) => {
          console.log('Order items change detected in admin:', payload);
          // Refresh orders when order items change
          fetchOrders();
          fetchStats();
        }
      )
      .subscribe();

    // Set up real-time subscription for food items
    const foodItemsChannel = supabase
      .channel('admin-food-items-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_items'
        },
        (payload) => {
          console.log('Food item change detected:', payload);
          fetchFoodItems();
        }
      )
      .subscribe();

    // Set up real-time subscription for variants
    const variantsChannel = supabase
      .channel('admin-variants-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_item_variants'
        },
        (payload) => {
          console.log('Variant change detected:', payload);
          fetchVariants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(foodItemsChannel);
      supabase.removeChannel(variantsChannel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setRefreshing(true);
      console.log('Admin: Fetching ALL orders...');
      
      // Fetch ALL orders without filtering by user_id
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          addresses:address_id (
            full_name,
            phone,
            address_line1,
            address_line2,
            city,
            state,
            pincode
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
        .order('created_at', { ascending: false });

      console.log('ordersData:', ordersData);

      if (ordersError) {
        console.error('Admin orders fetch error:', ordersError);
        throw ordersError;
      }

      console.log('Admin: Orders fetched:', ordersData?.length || 0);

      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchFoodItems = async () => {
    try {
      console.log('Fetching food items...');
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Food items fetch error:', error);
        throw error;
      }

      console.log('Food items fetched:', data?.length || 0);
      setFoodItems(data || []);
    } catch (error) {
      console.error('Error fetching food items:', error);
      toast.error('Failed to fetch food items');
    }
  };

  const fetchVariants = async () => {
    try {
      console.log('Fetching variants...');
      const { data, error } = await supabase
        .from('food_item_variants')
        .select('*')
        .order('price', { ascending: true });

      if (error) {
        console.error('Variants fetch error:', error);
        throw error;
      }

      console.log('Variants fetched:', data?.length || 0);
      setVariants(data || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
      toast.error('Failed to fetch variants');
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch ALL orders for stats calculation
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('status, total_amount');

      if (error) throw error;

      const totalOrders = ordersData?.length || 0;
      const ongoingOrders = ordersData?.filter(order => 
        !['delivered', 'cancelled'].includes(order.status)
      ).length || 0;
      const completedOrders = ordersData?.filter(order => 
        ['delivered'].includes(order.status)
      ).length || 0;
      const totalRevenue = ordersData?.reduce((sum, order) => 
        sum + parseFloat(order.total_amount.toString()), 0
      ) || 0;

      setStats({
        totalOrders,
        ongoingOrders,
        completedOrders,
        totalRevenue
      });

      console.log('Admin stats updated:', { totalOrders, ongoingOrders, completedOrders, totalRevenue });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      console.log('Admin: Updating order status:', orderId, newStatus);
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      if (error) {
        console.error('Order update error:', error);
        throw error;
      }

      console.log('Admin: Order status updated successfully');
      toast.success(`Order status updated to ${formatStatus(newStatus)}`);
      
      // Update local state immediately for better UX
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
            : order
        )
      );
      
      // Refresh stats to reflect changes
      await fetchStats();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      console.log('Adding new food item:', newItem);
      const { error } = await supabase
        .from('food_items')
        .insert({
          name: newItem.name,
          description: newItem.description,
          price: parseFloat(newItem.price),
          category: newItem.category,
          image_url: newItem.image_url || '/placeholder.svg',
          in_stock: true
        });

      if (error) {
        console.error('Add item error:', error);
        throw error;
      }

      console.log('Food item added successfully');
      toast.success('Food item added successfully');
      setIsAddItemDialogOpen(false);
      setNewItem({ name: '', description: '', price: '', category: '', image_url: '' });
      
      // Refresh data
      await fetchFoodItems();
    } catch (error) {
      console.error('Error adding food item:', error);
      toast.error('Failed to add food item');
    }
  };

  const handleEditItem = async () => {
    if (!editingItem || !editingItem.name || !editingItem.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      console.log('Updating food item:', editingItem);
      const { error } = await supabase
        .from('food_items')
        .update({
          name: editingItem.name,
          description: editingItem.description,
          price: editingItem.price,
          category: editingItem.category,
          image_url: editingItem.image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem.id);

      if (error) {
        console.error('Edit item error:', error);
        throw error;
      }

      console.log('Food item updated successfully');
      toast.success('Food item updated successfully');
      setEditingItem(null);
      
      // Refresh data
      await fetchFoodItems();
    } catch (error) {
      console.error('Error updating food item:', error);
      toast.error('Failed to update food item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      console.log('Deleting food item:', itemId);
      const { error } = await supabase
        .from('food_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Delete item error:', error);
        throw error;
      }

      console.log('Food item deleted successfully');
      toast.success('Food item deleted successfully');
      
      // Refresh data
      await fetchFoodItems();
    } catch (error) {
      console.error('Error deleting food item:', error);
      toast.error('Failed to delete food item');
    }
  };

  const toggleFoodItemStock = async (itemId: string, inStock: boolean) => {
    try {
      console.log('Toggling stock for item:', itemId, !inStock);
      const { error } = await supabase
        .from('food_items')
        .update({ 
          in_stock: !inStock, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', itemId);

      if (error) {
        console.error('Toggle stock error:', error);
        throw error;
      }

      console.log('Stock status updated successfully');
      toast.success(`Item ${!inStock ? 'marked as available' : 'marked as out of stock'}`);
      
      // Refresh data
      await fetchFoodItems();
    } catch (error) {
      console.error('Error updating food item stock:', error);
      toast.error('Failed to update item stock');
    }
  };

  // Variants management functions
  const handleAddVariant = async () => {
    if (!selectedFoodItemForVariants || !newVariant.label || !newVariant.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      console.log('Adding new variant:', newVariant);
      const { error } = await supabase
        .from('food_item_variants')
        .insert({
          food_item_id: selectedFoodItemForVariants.id,
          label: newVariant.label,
          price: parseFloat(newVariant.price)
        });

      if (error) {
        console.error('Add variant error:', error);
        throw error;
      }

      console.log('Variant added successfully');
      toast.success('Variant added successfully');
      setIsAddVariantDialogOpen(false);
      setNewVariant({ label: '', price: '' });
      
      // Refresh variants data
      await fetchVariants();
    } catch (error) {
      console.error('Error adding variant:', error);
      toast.error('Failed to add variant');
    }
  };

  const handleEditVariant = async () => {
    if (!editingVariant || !editingVariant.label || !editingVariant.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      console.log('Updating variant:', editingVariant);
      const { error } = await supabase
        .from('food_item_variants')
        .update({
          label: editingVariant.label,
          price: editingVariant.price
        })
        .eq('id', editingVariant.id);

      if (error) {
        console.error('Edit variant error:', error);
        throw error;
      }

      console.log('Variant updated successfully');
      toast.success('Variant updated successfully');
      setEditingVariant(null);
      
      // Refresh variants data
      await fetchVariants();
    } catch (error) {
      console.error('Error updating variant:', error);
      toast.error('Failed to update variant');
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;

    try {
      console.log('Deleting variant:', variantId);
      const { error } = await supabase
        .from('food_item_variants')
        .delete()
        .eq('id', variantId);

      if (error) {
        console.error('Delete variant error:', error);
        throw error;
      }

      console.log('Variant deleted successfully');
      toast.success('Variant deleted successfully');
      
      // Refresh variants data
      await fetchVariants();
    } catch (error) {
      console.error('Error deleting variant:', error);
      toast.error('Failed to delete variant');
    }
  };

  const getVariantsForItem = (foodItemId: string) => {
    return variants.filter(variant => variant.food_item_id === foodItemId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'out_for_delivery':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdminLoggedIn');
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const handleRefresh = async () => {
    await fetchOrders();
    await fetchFoodItems();
    await fetchVariants();
    await fetchStats();
    toast.success('Data refreshed successfully');
  };

  // Separate orders into ongoing and completed
  const ongoingOrders = orders.filter(order => 
    !['delivered', 'cancelled'].includes(order.status)
  );
  const completedOrders = orders.filter(order => 
    ['delivered', 'cancelled'].includes(order.status)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome to AAYISH Admin Panel</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Package className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Ongoing Orders</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.ongoingOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.completedOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">₹{stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === 'orders'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Orders Management
              </button>
              <button
                onClick={() => setActiveTab('menu')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === 'menu'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Menu Management
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Ongoing Orders */}
            {ongoingOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Ongoing Orders ({ongoingOrders.length})</span>
                    {refreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ongoingOrders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-blue-50">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold">Order #{order.id.slice(-8)}</h3>
                            <p className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(order.status)}>
                              {formatStatus(order.status)}
                            </Badge>
                            <p className="text-lg font-semibold mt-1">₹{order.total_amount}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="font-medium mb-2">Items</h4>
                            <div className="space-y-1">
                              {order.order_items.map((item) => (
                                <p key={item.id} className="text-sm text-gray-600">
                                  {item.food_items.name} x {item.quantity} - ₹{item.unit_price}
                                </p>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-2">Delivery Address</h4>
                            <div className="border rounded p-2 bg-gray-50 text-sm text-gray-600">
                              <div><strong>Name:</strong> {order.addresses?.full_name || 'N/A'}</div>
                              <div><strong>Phone:</strong> {order.addresses?.phone || ''}</div>
                              <div><strong>Address:</strong> {order.addresses?.address_line1 || ''}</div>
                              {order.addresses?.address_line2 && (
                                <div><strong>Landmark/Area:</strong> {order.addresses.address_line2}</div>
                              )}
                              <div>
                                <strong>City:</strong> {order.addresses?.city || ''},
                                <strong> State:</strong> {order.addresses?.state || ''},
                                <strong> Pincode:</strong> {order.addresses?.pincode || ''}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Select
                            value={order.status}
                            onValueChange={(value) => updateOrderStatus(order.id, value)}
                            disabled={updatingOrderId === order.id}
                          >
                            <SelectTrigger className="w-full sm:w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="preparing">Preparing</SelectItem>
                              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingOrderId === order.id && (
                            <div className="flex items-center text-sm text-gray-500">
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              Updating...
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Orders */}
            {completedOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Completed Orders ({completedOrders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {completedOrders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-green-50 opacity-75">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold">Order #{order.id.slice(-8)}</h3>
                            <p className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(order.status)}>
                              {formatStatus(order.status)}
                            </Badge>
                            <p className="text-lg font-semibold mt-1">₹{order.total_amount}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-600">
                              {order.order_items.length} item(s)
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {orders.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 text-lg mb-4">No orders found</p>
                  <p className="text-gray-400">Orders will appear here once customers start placing them!</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Menu Items Management</CardTitle>
                <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add New Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Food Item</DialogTitle>
                      <DialogDescription>
                        Add a new item to your menu
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          placeholder="Item name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newItem.description}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          placeholder="Item description"
                        />
                      </div>
                      <div>
                        <Label htmlFor="price">Price *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={newItem.price}
                          onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                          placeholder="Price in ₹"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={newItem.category}
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                          placeholder="e.g., Pickles, Sweets"
                        />
                      </div>
                      <div>
                        <Label htmlFor="image_url">Image URL</Label>
                        <Input
                          id="image_url"
                          value={newItem.image_url}
                          onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                      <Button onClick={handleAddItem} className="w-full">
                        Add Item
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {foodItems.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No food items found</p>
                    </div>
                  ) : (
                    foodItems.map((item) => {
                      const itemVariants = getVariantsForItem(item.id);
                      return (
                        <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <img
                            src={item.image_url || '/placeholder.svg'}
                            alt={item.name}
                            className="w-full h-32 object-cover rounded mb-3"
                          />
                          <h3 className="font-semibold text-sm sm:text-base">{item.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                          <p className="text-orange-600 font-medium mb-2">₹{item.price}</p>
                          {item.category && (
                            <p className="text-xs sm:text-sm text-gray-500 mb-3">Category: {item.category}</p>
                          )}
                          
                          {/* Variants Display */}
                          {itemVariants.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">Variants:</p>
                              <div className="space-y-1">
                                {itemVariants.map((variant) => (
                                  <div key={variant.id} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                                    <span className="text-gray-600">{variant.label}</span>
                                    <span className="font-medium text-orange-600">₹{variant.price}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mb-3">
                            <Badge className={item.in_stock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {item.in_stock ? 'In Stock' : 'Out of Stock'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleFoodItemStock(item.id, item.in_stock)}
                              className="text-xs"
                            >
                              {item.in_stock ? 'Mark Out' : 'Mark Available'}
                            </Button>
                          </div>
                          
                          <div className="flex gap-2 mb-2">
                            <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingItem(item)}
                                  className="flex-1 text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Edit Food Item</DialogTitle>
                                </DialogHeader>
                                {editingItem && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="edit-name">Name *</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingItem.name}
                                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-description">Description</Label>
                                      <Textarea
                                        id="edit-description"
                                        value={editingItem.description}
                                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-price">Price *</Label>
                                      <Input
                                        id="edit-price"
                                        type="number"
                                        step="0.01"
                                        value={editingItem.price}
                                        onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-category">Category</Label>
                                      <Input
                                        id="edit-category"
                                        value={editingItem.category}
                                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-image_url">Image URL</Label>
                                      <Input
                                        id="edit-image_url"
                                        value={editingItem.image_url}
                                        onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                                      />
                                    </div>
                                    <Button onClick={handleEditItem} className="w-full">
                                      Update Item
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                              className="flex-1 text-xs"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                          
                          {/* Variants Management Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedFoodItemForVariants(item);
                              setIsAddVariantDialogOpen(true);
                            }}
                            className="w-full text-xs"
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Manage Variants
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Variant Dialog */}
        <Dialog open={isAddVariantDialogOpen} onOpenChange={setIsAddVariantDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Manage Variants for {selectedFoodItemForVariants?.name}
              </DialogTitle>
              <DialogDescription>
                Add, edit, or remove variants for this food item
              </DialogDescription>
            </DialogHeader>
            
            {/* Add New Variant Form */}
            <div className="space-y-4 border-b pb-4">
              <h4 className="font-medium">Add New Variant</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="variant-label">Label</Label>
                  <Input
                    id="variant-label"
                    value={newVariant.label}
                    onChange={(e) => setNewVariant({ ...newVariant, label: e.target.value })}
                    placeholder="e.g., 250g, 500g"
                  />
                </div>
                <div>
                  <Label htmlFor="variant-price">Price</Label>
                  <Input
                    id="variant-price"
                    type="number"
                    step="0.01"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                    placeholder="Price in ₹"
                  />
                </div>
              </div>
              <Button onClick={handleAddVariant} className="w-full">
                Add Variant
              </Button>
            </div>
            
            {/* Existing Variants List */}
            <div className="space-y-3">
              <h4 className="font-medium">Existing Variants</h4>
              {selectedFoodItemForVariants && getVariantsForItem(selectedFoodItemForVariants.id).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No variants added yet</p>
              ) : (
                selectedFoodItemForVariants && getVariantsForItem(selectedFoodItemForVariants.id).map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{variant.label}</p>
                      <p className="text-sm text-orange-600">₹{variant.price}</p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={editingVariant?.id === variant.id} onOpenChange={(open) => !open && setEditingVariant(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingVariant(variant)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Edit Variant</DialogTitle>
                          </DialogHeader>
                          {editingVariant && (
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="edit-variant-label">Label</Label>
                                <Input
                                  id="edit-variant-label"
                                  value={editingVariant.label}
                                  onChange={(e) => setEditingVariant({ ...editingVariant, label: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-variant-price">Price</Label>
                                <Input
                                  id="edit-variant-price"
                                  type="number"
                                  step="0.01"
                                  value={editingVariant.price}
                                  onChange={(e) => setEditingVariant({ ...editingVariant, price: parseFloat(e.target.value) })}
                                />
                              </div>
                              <Button onClick={handleEditVariant} className="w-full">
                                Update Variant
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteVariant(variant.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
