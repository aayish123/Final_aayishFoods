import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import SocialIcons from '@/components/SocialIcons';
import { Clock, CheckCircle, Truck, Package } from 'lucide-react';
import { useCustomerOrders } from '@/shared/hooks/useCustomerOrders';
import { useQueryClient } from '@tanstack/react-query';
import { getOptimizedImageUrl } from '@/lib/utils';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  product_name_snapshot: string | null;
  variant_name_snapshot: string | null;
  food_items: {
    name: string;
    image_url: string;
  } | null;
}

interface Address {
  full_name: string;
  address_line1: string;
  city: string;
  phone: string;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
  addresses: Address | null;
}

const Orders = () => {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 5;
  const { data, isLoading: loading } = useCustomerOrders(user?.id, page, pageSize);
  const rawOrders = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    
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
          queryClient.invalidateQueries({ queryKey: ['customer-orders', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, openAuthModal, queryClient]);

  // Cast orders properly
  const orders: Order[] = (rawOrders || []).map((order: any) => ({
    id: order.id,
    total_amount: order.total_amount,
    status: order.status,
    payment_status: order.payment_status,
    created_at: order.created_at,
    updated_at: order.updated_at,
    order_items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      product_name_snapshot: item.product_name_snapshot,
      variant_name_snapshot: item.variant_name_snapshot,
      food_items: item.food_items
    })),
    addresses: order.addresses
  }));

  // Separate active and past orders with real-time updates
  const activeOrders = orders.filter(order => 
    !['delivered', 'cancelled', 'returned', 'refunded'].includes(order.status)
  );
  const pastOrders = orders.filter(order => 
    ['delivered', 'cancelled', 'returned', 'refunded'].includes(order.status)
  );

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
      case 'payment_review':
        return <Clock className="h-4 w-4 text-orange-500" />;
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
      case 'payment_review':
        return 'bg-amber-100 text-amber-800';
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
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SocialIcons />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Your Orders</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full"></div>
        </div>
        
        {location.state?.orderId && (
          <div className="mb-8 p-6 bg-green-50/50 border border-green-200 rounded-2xl shadow-sm flex items-center justify-center animate-in slide-in-from-top-4 duration-500">
            <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
            <p className="text-green-800 font-medium text-lg">
              Order placed successfully! <span className="font-bold opacity-75 ml-2">ID: {location.state.orderId}</span>
            </p>
          </div>
        )}

        {activeOrders.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-6 flex items-center">
              <span className="w-2 h-8 bg-primary rounded-full mr-3"></span>
              Active Orders
            </h2>
            <div className="space-y-6">
              {activeOrders.map((order) => (
                <Card key={order.id} className="shadow-lg shadow-primary/5 border border-border/50 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300">
                  <CardHeader className="bg-secondary/5 border-b border-border/40 py-5">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                      <div>
                        <CardTitle className="text-xl font-bold font-serif mb-1 text-foreground">Order #{order.id.slice(-8).toUpperCase()}</CardTitle>
                        <p className="text-sm font-medium text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {order.updated_at !== order.created_at && (
                          <p className="text-xs text-muted-foreground/60 mt-1 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Updated: {new Date(order.updated_at).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <Badge className={`${getStatusColor(order.status)} px-4 py-1.5 rounded-full border-0 font-semibold tracking-wide uppercase text-xs shadow-sm flex items-center space-x-2`}>
                        {getStatusIcon(order.status)}
                        <span>{formatStatus(order.status)}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Items Ordered</h4>
                        <div className="space-y-3">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex items-center space-x-4 bg-muted/20 p-3 rounded-xl border border-border/40">
                              <img
                                src={getOptimizedImageUrl(item.food_items?.image_url)}
                                alt={item.product_name_snapshot || item.food_items?.name || 'Food Item'}
                                className="w-14 h-14 object-cover rounded-lg shadow-sm"
                                loading="lazy"
                              />
                              <div className="flex-1">
                                <p className="text-base font-semibold text-foreground leading-tight mb-1">
                                  {item.product_name_snapshot || item.food_items?.name || 'Food Item'}
                                </p>
                                <p className="text-sm font-medium text-muted-foreground">
                                  Qty: {item.quantity} <span className="mx-1 text-border/60">|</span> 
                                  <span className="text-muted-foreground mr-1">({item.variant_name_snapshot || 'Standard'})</span>
                                  <span className="text-primary font-semibold">₹{item.unit_price}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Delivery Details</h4>
                          {order.addresses ? (
                            <div className="bg-secondary/10 p-4 rounded-xl border border-secondary/20">
                              <p className="font-semibold text-foreground mb-1">{order.addresses.full_name}</p>
                              <p className="text-sm text-foreground/80 leading-relaxed">
                                {order.addresses.address_line1}<br />
                                {order.addresses.city}
                              </p>
                              <p className="text-sm font-medium text-muted-foreground mt-2 flex items-center">
                                <span className="w-8">Tel:</span> {order.addresses.phone}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-secondary/10 p-4 rounded-xl border border-secondary/20 text-muted-foreground text-sm">
                              Delivery address details not found.
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-6 p-4 rounded-xl border-2 border-border/50 bg-white shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Payment Status</p>
                            <Badge variant="outline" className={`font-semibold ${order.payment_status === 'completed' || order.payment_status === 'paid' ? 'text-green-600 border-green-200 bg-green-50' : 'text-orange-600 border-orange-200 bg-orange-50'}`}>
                              {order.payment_status === 'completed' || order.payment_status === 'paid' ? 'Paid Online' : 'Cash on Delivery'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-end mt-2 pt-2 border-t border-border/40">
                            <p className="font-bold text-foreground">Total Amount</p>
                            <p className="text-2xl font-bold text-primary">₹{order.total_amount}</p>
                          </div>
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
            <h2 className="text-2xl font-serif font-bold text-foreground/80 mb-6 flex items-center">
              <span className="w-2 h-8 bg-muted rounded-full mr-3"></span>
              Order History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastOrders.map((order) => (
                <Card key={order.id} className="opacity-80 hover:opacity-100 transition-opacity duration-300 border border-border/60 rounded-2xl overflow-hidden bg-white/50">
                  <CardHeader className="bg-muted/30 py-4 border-b border-border/40">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold font-serif text-foreground">#{order.id.slice(-8).toUpperCase()}</CardTitle>
                        <p className="text-xs font-medium text-muted-foreground mt-1">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(order.status)} text-[10px] uppercase tracking-wider font-bold border-0`}>
                        {formatStatus(order.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-muted-foreground flex items-center">
                        <Package className="h-4 w-4 mr-2 opacity-50" />
                        {order.order_items.length} item(s)
                      </div>
                      <p className="font-bold text-lg text-primary">₹{order.total_amount}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {orders.length > 0 && totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}

        {orders.length === 0 && (
          <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden mt-8">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 mx-auto bg-secondary/30 rounded-full flex items-center justify-center mb-6">
                <Package className="h-10 w-10 text-primary opacity-50" />
              </div>
              <p className="text-foreground text-2xl font-serif font-bold mb-3">No orders found</p>
              <p className="text-muted-foreground text-lg mb-8">Start ordering from our delicious menu!</p>
              <Button onClick={() => navigate('/menu')} size="lg" className="rounded-full px-8 shadow-md h-12 text-lg">
                Explore Menu
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Orders;
