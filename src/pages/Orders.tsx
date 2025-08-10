
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import SocialIcons from '@/components/SocialIcons';
import { Clock, CheckCircle, Truck, Package } from 'lucide-react';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    food_items: {
      name: string;
      image_url: string;
    };
  }[];
  addresses: {
    full_name: string;
    address_line1: string;
    city: string;
    phone: string;
  };
}

const Orders = () => {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    fetchOrders();
    
    // Set up real-time subscription for order status updates with improved handling
    const channel = supabase
      .channel('user-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('User: Order status update received:', payload);
          // Refresh orders immediately when status changes
          fetchOrders();
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
          console.log('User: Order items update received:', payload);
          // Check if this order item belongs to current user and refresh if needed
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchOrders = async () => {
    try {
      console.log('User: Fetching user orders...');
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            food_items (
              name,
              image_url
            )
          ),
          addresses (
            full_name,
            address_line1,
            city,
            phone
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }

      const ordersData = data || [];
      console.log('User: orders fetched:', ordersData.length);
      setOrders(ordersData);
      
      // Separate active and past orders with real-time updates
      const active = ordersData.filter(order => 
        !['delivered', 'cancelled'].includes(order.status)
      );
      const past = ordersData.filter(order => 
        ['delivered', 'cancelled'].includes(order.status)
      );
      
      setActiveOrders(active);
      setPastOrders(past);
      console.log('User: Active orders:', active.length, 'Past orders:', past.length);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'preparing':
        return <Package className="h-4 w-4" />;
      case 'out_for_delivery':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Orders</h1>
        
        {location.state?.orderId && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              🎉 Order placed successfully! Order ID: {location.state.orderId}
            </p>
          </div>
        )}

        {activeOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Orders</h2>
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Order #{order.id.slice(-8)}</CardTitle>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {order.updated_at !== order.created_at && (
                          <p className="text-xs text-gray-400">
                            Last updated: {new Date(order.updated_at).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(order.status)}
                          <span>{formatStatus(order.status)}</span>
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">Items Ordered</h4>
                        <div className="space-y-2">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex items-center space-x-3">
                              <img
                                src={item.food_items.image_url || '/placeholder.svg'}
                                alt={item.food_items.name}
                                className="w-10 h-10 object-cover rounded"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{item.food_items.name}</p>
                                <p className="text-xs text-gray-500">
                                  Qty: {item.quantity} × ₹{item.unit_price}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Delivery Address</h4>
                        <p className="text-sm text-gray-600">
                          {order.addresses.full_name}<br />
                          {order.addresses.address_line1}<br />
                          {order.addresses.city}<br />
                          Phone: {order.addresses.phone}
                        </p>
                        
                        <div className="mt-4">
                          <p className="font-medium">Total: ₹{order.total_amount}</p>
                          <p className="text-sm text-gray-500">
                            Payment: {order.payment_status === 'completed' ? 'Paid' : 'Cash on Delivery'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pastOrders.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order History</h2>
            <div className="space-y-4">
              {pastOrders.map((order) => (
                <Card key={order.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Order #{order.id.slice(-8)}</CardTitle>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {formatStatus(order.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">
                          {order.order_items.length} item(s)
                        </p>
                      </div>
                      <p className="font-medium">₹{order.total_amount}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {orders.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg mb-4">No orders found</p>
              <p className="text-gray-400">Start ordering from our delicious menu!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Orders;
