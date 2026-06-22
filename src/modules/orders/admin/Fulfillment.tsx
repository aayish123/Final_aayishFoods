import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createNotification } from '@/lib/admin/notifications';
import {
  Package,
  Truck,
  CheckCircle,
  RotateCcw,
  DollarSign,
  RefreshCw,
  Search,
  ArrowRight,
  MapPin,
  ExternalLink,
  Clock,
  AlertOctagon,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { orderService } from '@/shared/services/orderService';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  food_items: {
    name: string;
  } | null;
}

interface Order {
  id: string;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  created_at: string;
  user_id: string | null;
  tracking_number: string | null;
  courier_partner: string | null;
  dispatch_date: string | null;
  payment_review_reason?: string | null;
  addresses: {
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
  order_items: OrderItem[];
}

interface RefundRequest {
  id: string;
  order_id: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'failed';
  created_at: string;
  orders: {
    total_amount: number;
    user_id: string | null;
    addresses: {
      full_name: string;
    } | null;
  } | null;
}

export default function AdminFulfillment() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'packing' | 'shipping' | 'delivered' | 'returns' | 'payment_review' | 'refunds'>('packing');
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Shipping dialog states
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courierPartner, setCourierPartner] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [isShipDialogOpen, setIsShipDialogOpen] = useState(false);

  // Refund dialog states
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundNotes, setRefundNotes] = useState('');

  useEffect(() => {
    fetchFulfillmentData();

    // Subscribe to order realtime updates
    const ordersChannel = supabase
      .channel('fulfillment-admin-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchFulfillmentData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_refunds' },
        () => {
          fetchFulfillmentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [activeTab]);

  const fetchFulfillmentData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'refunds') {
        const { data, error } = await supabase
          .from('order_refunds')
          .select(`
            *,
            orders:order_id (
              total_amount,
              user_id,
              addresses:address_id (
                full_name
              )
            )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRefunds((data as unknown as RefundRequest[]) || []);
      } else {
        let query = supabase
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
                name
              )
            )
          `);

        if (activeTab === 'packing') {
          query = query
            .eq('status', 'confirmed')
            .in('payment_status', ['completed', 'paid']);
        } else if (activeTab === 'shipping') {
          query = query.eq('status', 'packed');
        } else if (activeTab === 'delivered') {
          query = query.eq('status', 'shipped');
        } else if (activeTab === 'returns') {
          query = query.eq('status', 'returned');
        } else if (activeTab === 'payment_review') {
          query = query.eq('status', 'payment_review');
        }

        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        setOrders((data as unknown as Order[]) || []);
      }
    } catch (err: any) {
      toast.error(`Queue load failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPacked = async (orderId: string, userId: string | null) => {
    try {
      const nowString = new Date().toISOString();
      await orderService.updateOrderStatus(
        orderId,
        {
          status: 'packed',
          packed_at: nowString
        },
        'Order marked as Packed and ready for dispatch in Fulfillment Center.',
        user?.id || ''
      );

      if (userId) {
        await createNotification(
          userId,
          'Order Packed',
          `Your order #${orderId.slice(-8).toUpperCase()} has been packed and is ready for courier hand-off!`,
          'order'
        );
      }

      toast.success('Order successfully moved to Shipping Queue');
      fetchFulfillmentData();
    } catch (err: any) {
      toast.error(`Error marking packed: ${err.message}`);
    }
  };

  const handleOpenShipDialog = (order: Order) => {
    setSelectedOrder(order);
    setCourierPartner('');
    setTrackingNumber('');
    setDispatchDate(new Date().toISOString().slice(0, 16));
    setIsShipDialogOpen(true);
  };

  const handleDispatchOrder = async () => {
    if (!selectedOrder) return;
    if (!courierPartner.trim()) {
      toast.error('Courier Partner is required');
      return;
    }
    if (!trackingNumber.trim()) {
      toast.error('Tracking Number is required');
      return;
    }

    try {
      const nowString = new Date().toISOString();
      const dispatchTime = dispatchDate ? new Date(dispatchDate).toISOString() : nowString;

      await orderService.updateOrderStatus(
        selectedOrder.id,
        {
          status: 'shipped',
          shipped_at: nowString,
          courier_partner: courierPartner,
          tracking_number: trackingNumber,
          dispatch_date: dispatchTime
        },
        `Dispatched via ${courierPartner}. Tracking Ref: ${trackingNumber}.`,
        user?.id || ''
      );

      if (selectedOrder.user_id) {
        await createNotification(
          selectedOrder.user_id,
          'Order Shipped',
          `Your order #${selectedOrder.id.slice(-8).toUpperCase()} has been dispatched via ${courierPartner}. Tracking ID: ${trackingNumber}.`,
          'order'
        );
      }

      toast.success('Order successfully marked as Shipped');
      setIsShipDialogOpen(false);
      setSelectedOrder(null);
      fetchFulfillmentData();
    } catch (err: any) {
      toast.error(`Shipment dispatch failed: ${err.message}`);
    }
  };

  const handleMarkDelivered = async (orderId: string, userId: string | null) => {
    try {
      const nowString = new Date().toISOString();
      await orderService.updateOrderStatus(
        orderId,
        {
          status: 'delivered',
          delivered_at: nowString
        },
        'Package delivered successfully to customer address.',
        user?.id || ''
      );

      if (userId) {
        await createNotification(
          userId,
          'Order Delivered',
          `Your order #${orderId.slice(-8).toUpperCase()} has been delivered successfully. Thank you for choosing Aayish Foods!`,
          'order'
        );
      }

      toast.success('Order marked as Delivered');
      fetchFulfillmentData();
    } catch (err: any) {
      toast.error(`Delivery status update failed: ${err.message}`);
    }
  };

  const handleConfirmPaymentReview = async (orderId: string, userId: string | null) => {
    try {
      await orderService.updateOrderStatus(
        orderId,
        {
          status: 'confirmed',
          payment_review_reason: null
        },
        'Payment review resolved. Order status shifted to Confirmed for stock allocation.',
        user?.id || ''
      );
      
      toast.success('Payment review resolved. Order status shifted to Confirmed for stock allocation.');
      fetchFulfillmentData();
    } catch (err: any) {
      toast.error(`Re-allocation failed: ${err.message}`);
    }
  };

  const handleCancelPaymentReview = async (orderId: string, userId: string | null, amount: number) => {
    confirm({
      title: 'Cancel & Refund Order',
      message: `Are you sure you want to cancel this order and refund ₹${amount.toFixed(2)} to the customer?`,
      confirmText: 'Confirm Cancel',
      cancelText: 'Go Back',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await orderService.updateOrderStatus(
            orderId,
            {
              status: 'cancelled',
              payment_status: 'refunded'
            },
            'Order cancelled during payment review due to stock unavailability.',
            user?.id || ''
          );

          const { error: refundErr } = await supabase
            .from('order_refunds')
            .insert({
              order_id: orderId,
              amount,
              reason: 'Stock unavailable during checkout allocation review',
              status: 'approved',
              approved_by: user?.id || null
            });
          if (refundErr) throw refundErr;

          await createNotification(
            userId || '',
            'Order Cancelled & Refunded',
            `Your order #${orderId.slice(-8).toUpperCase()} was cancelled due to stock unavailability and a refund of ₹${amount.toFixed(2)} has been approved.`,
            'order'
          );

          toast.success('Order cancelled and refund transaction generated successfully');
          fetchFulfillmentData();
        } catch (err: any) {
          toast.error(`Failed to cancel order: ${err.message}`);
        }
      }
    });
  };

  const handleOpenRefundDialog = (refund: RefundRequest) => {
    setSelectedRefund(refund);
    setRefundNotes('');
    setIsRefundDialogOpen(true);
  };

  const handleProcessRefund = async (approve: boolean) => {
    if (!selectedRefund) return;

    try {
      await orderService.processRefund(
        selectedRefund.id,
        approve,
        refundNotes,
        user?.id || ''
      );

      if (approve && selectedRefund.orders?.user_id) {
        await createNotification(
          selectedRefund.orders.user_id,
          'Refund Approved',
          `Your refund of ₹${selectedRefund.amount.toFixed(2)} for order #${selectedRefund.order_id.slice(-8).toUpperCase()} has been approved.`,
          'order'
        );
      }

      toast.success(`Refund request ${approve ? 'approved' : 'rejected'} successfully`);
      setIsRefundDialogOpen(false);
      setSelectedRefund(null);
      fetchFulfillmentData();
    } catch (err: any) {
      toast.error(`Refund processing failed: ${err.message}`);
    }
  };

  // Search filter
  const filteredOrders = orders.filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.id.toLowerCase().includes(term) ||
      (o.addresses?.full_name && o.addresses.full_name.toLowerCase().includes(term)) ||
      (o.addresses?.phone && o.addresses.phone.includes(term)) ||
      (o.addresses?.pincode && o.addresses.pincode.includes(term))
    );
  });

  const filteredRefunds = refunds.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.order_id.toLowerCase().includes(term) ||
      (r.orders?.addresses?.full_name && r.orders.addresses.full_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Fulfillment Center</h1>
          <p className="text-gray-500 text-sm mt-1">Manage packing workflow pipelines, dispatch courier tracking numbers, and process returns.</p>
        </div>
        <Button onClick={fetchFulfillmentData} variant="outline" className="border-gray-200 bg-white hover:bg-gray-50" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queues
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200">
        {[
          { label: 'Packing Queue', value: 'packing', icon: Package, badgeColor: 'bg-amber-100 text-amber-800' },
          { label: 'Shipping Queue', value: 'shipping', icon: Truck, badgeColor: 'bg-purple-100 text-purple-800' },
          { label: 'Delivered Queue', value: 'delivered', icon: CheckCircle, badgeColor: 'bg-green-100 text-green-800' },
          { label: 'Return Queue', value: 'returns', icon: RotateCcw, badgeColor: 'bg-gray-100 text-gray-800' },
          { label: 'Payment Review', value: 'payment_review', icon: Clock, badgeColor: 'bg-amber-100 text-amber-800' },
          { label: 'Refund Claims', value: 'refunds', icon: DollarSign, badgeColor: 'bg-red-100 text-red-800' }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setActiveTab(tab.value as any);
                setSearchTerm('');
              }}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-all -mb-[2px] ${
                isActive
                  ? 'border-[#1a3b2b] text-[#1a3b2b]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search Header */}
      <div className="flex items-center space-x-3 bg-white p-4 rounded-xl border border-[#1a3b2b]/5 shadow-sm max-w-sm">
        <Search className="h-4 w-4 text-gray-400 shrink-0" />
        <Input
          placeholder={activeTab === 'refunds' ? "Search refunds by Order ID or name..." : "Search orders by ID, Customer name, Phone, Pincode..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none focus-visible:ring-0 p-0 text-sm h-auto bg-transparent placeholder-gray-400"
        />
      </div>

      {/* Grid of cards queue */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-2">
          <RefreshCw className="h-8 w-8 text-[#1a3b2b] animate-spin" />
          <span className="text-xs text-gray-400 font-bold uppercase">Loading pipeline queue...</span>
        </div>
      ) : activeTab === 'refunds' ? (
        filteredRefunds.length === 0 ? (
          <Card className="bg-[#fdfbf7]/40 border border-dashed border-gray-200 rounded-2xl py-16 text-center text-gray-400">
            No pending refund claims found.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRefunds.map(ref => (
              <Card key={ref.id} className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="bg-red-50/40 border-b border-red-100 p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Refund Claim</span>
                      <p className="font-mono text-xs font-bold text-gray-900 mt-1">#{ref.order_id.slice(-8).toUpperCase()}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-800 border-none font-bold text-[9px] uppercase px-2 py-0.5">
                      {ref.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-xs font-semibold text-gray-600 flex-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400 uppercase text-[9px]">Client</span>
                    <span className="text-gray-900">{ref.orders?.addresses?.full_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 uppercase text-[9px]">Refund Amount</span>
                    <span className="text-red-600 font-extrabold text-sm">₹{Number(ref.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 uppercase text-[9px]">Order Total</span>
                    <span className="text-gray-900">₹{Number(ref.orders?.total_amount || 0).toFixed(2)}</span>
                  </div>
                  {ref.reason && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 mt-2 font-medium italic text-gray-500">
                      "{ref.reason}"
                    </div>
                  )}
                </CardContent>
                <div className="p-5 border-t border-gray-100 bg-[#fdfbf7]/50 flex gap-2">
                  <Button
                    onClick={() => handleOpenRefundDialog(ref)}
                    className="w-full bg-[#1a3b2b] text-[#d4af37] text-xs h-10 font-bold hover:bg-[#122b20]"
                  >
                    Assess Claim
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : filteredOrders.length === 0 ? (
        <Card className="bg-[#fdfbf7]/40 border border-dashed border-gray-200 rounded-2xl py-16 text-center text-gray-400">
          No orders waiting in this queue.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map(order => (
            <Card key={order.id} className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <CardHeader className="bg-[#fdfbf7]/60 border-b border-[#1a3b2b]/5 p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-1">
                      <Package className="h-4 w-4 text-[#1a3b2b]" />
                      <p className="font-mono text-xs font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      Ordered: {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant="outline" className={`capitalize text-[9px] font-bold ${
                    order.status === 'confirmed' ? 'bg-blue-50 text-blue-800' :
                    order.status === 'packed' ? 'bg-purple-50 text-purple-800' :
                    order.status === 'shipped' ? 'bg-indigo-50 text-indigo-800' :
                    order.status === 'payment_review' ? 'bg-amber-50 text-amber-800' :
                    'bg-gray-50 text-gray-800'
                  }`}>
                    {order.status === 'payment_review' ? 'Payment Review' : order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs font-semibold text-gray-600 flex-1">
                {/* Client address details */}
                <div className="space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center space-x-1.5 text-gray-900 font-bold">
                    <MapPin className="h-3.5 w-3.5 text-[#5c2018]" />
                    <span>{order.addresses?.full_name}</span>
                  </div>
                  <p className="text-gray-400 mt-0.5">{order.addresses?.phone}</p>
                  <p className="text-gray-500 font-medium leading-relaxed text-[11px] mt-1.5">
                    {order.addresses?.address_line1}, {order.addresses?.city} - {order.addresses?.pincode}
                  </p>
                </div>

                {order.status === 'payment_review' && order.payment_review_reason && (
                  <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl">
                    <AlertOctagon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-[10px] uppercase">Reason for Review</p>
                      <p className="font-medium text-[11px] mt-0.5">
                        {order.payment_review_reason === 'stock_unavailable' 
                          ? 'Stock depleted during payment processing' 
                          : order.payment_review_reason === 'allocation_failed' 
                            ? 'Allocation conflict / inventory mismatch' 
                            : order.payment_review_reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Items list */}
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Package Items</span>
                  <ul className="space-y-1.5 max-h-32 overflow-y-auto divide-y divide-gray-100 pr-1">
                    {order.order_items.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-gray-800 font-medium py-1.5">
                        <span>{item.food_items?.name || 'Delicacy'}</span>
                        <span className="font-mono text-xs font-bold text-gray-900">Qty: {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              {/* Status workflow triggers */}
              <div className="p-5 border-t border-gray-100 bg-[#fdfbf7]/50 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/admin/orders/${order.id}`, '_blank')}
                  className="h-11 w-11 sm:h-10 sm:w-10 border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shrink-0 rounded-xl flex items-center justify-center inline-flex"
                  title="Open order detail"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>

                {activeTab === 'packing' && (
                  <Button
                    onClick={() => handleMarkPacked(order.id, order.user_id)}
                    className="w-full bg-[#1a3b2b] text-[#d4af37] text-sm sm:text-xs h-11 sm:h-10 font-bold hover:bg-[#122b20] rounded-xl"
                  >
                    Approve Packing Complete
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                )}

                {activeTab === 'shipping' && (
                  <Button
                    onClick={() => handleOpenShipDialog(order)}
                    className="w-full bg-[#5c2018] text-[#d4af37] text-sm sm:text-xs h-11 sm:h-10 font-bold hover:bg-[#431610] rounded-xl"
                  >
                    Enter Courier Details
                    <Truck className="h-4 w-4 ml-1.5" />
                  </Button>
                )}

                {activeTab === 'delivered' && (
                  <Button
                    onClick={() => handleMarkDelivered(order.id, order.user_id)}
                    className="w-full bg-green-700 text-white text-sm sm:text-xs h-11 sm:h-10 font-bold hover:bg-green-800 rounded-xl"
                  >
                    Confirm Delivery Recieved
                    <CheckCircle className="h-4 w-4 ml-1.5" />
                  </Button>
                )}

                {activeTab === 'returns' && (
                  <Button
                    onClick={() => window.open(`/admin/orders/${order.id}`, '_blank')}
                    className="w-full bg-amber-600 text-white text-sm sm:text-xs h-11 sm:h-10 font-bold hover:bg-amber-700 rounded-xl"
                  >
                    Assess Return Refund
                    <RotateCcw className="h-4 w-4 ml-1.5" />
                  </Button>
                )}

                {activeTab === 'payment_review' && (
                  <div className="flex gap-2 w-full">
                    <Button
                      onClick={() => handleCancelPaymentReview(order.id, order.user_id, order.total_amount)}
                      variant="outline"
                      className="w-1/2 border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-sm sm:text-xs h-11 sm:h-10 font-bold rounded-xl"
                    >
                      <XCircle className="h-4 w-4 mr-1 shrink-0" />
                      Refund & Cancel
                    </Button>
                    <Button
                      onClick={() => handleConfirmPaymentReview(order.id, order.user_id)}
                      className="w-1/2 bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20] text-sm sm:text-xs h-11 sm:h-10 font-bold rounded-xl"
                    >
                      <CheckCircle className="h-4 w-4 mr-1 shrink-0" />
                      Reallocate Stock
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Courier details dialog */}
      <Dialog open={isShipDialogOpen} onOpenChange={setIsShipDialogOpen}>
        <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto sm:max-w-md bg-white rounded-2xl border border-gray-100 p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#5c2018] text-xl font-bold">Courier Dispatch Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Provide tracking parameters for order #{selectedOrder?.id.slice(-8).toUpperCase()} to move status to Shipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="courier" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Courier Partner</Label>
              <Input
                id="courier"
                placeholder="e.g. Delhivery, BlueDart, Professional"
                value={courierPartner}
                onChange={(e) => setCourierPartner(e.target.value)}
                className="rounded-xl border-gray-200"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tracking" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tracking Number / AWB</Label>
              <Input
                id="tracking"
                placeholder="e.g. AAY-892471203"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="rounded-xl border-gray-200 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispatch" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dispatch Date & Time</Label>
              <Input
                id="dispatch"
                type="datetime-local"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="rounded-xl border-gray-200"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsShipDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleDispatchOrder} className="bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20] rounded-xl font-bold">
              Dispatch Shipments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund assessment dialog */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto sm:max-w-md bg-white rounded-2xl border border-gray-100 p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#5c2018] text-xl font-bold">Assess Refund Claim</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review and process refund claim for order #{selectedRefund?.order_id.slice(-8).toUpperCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-xs font-semibold text-gray-700 space-y-2">
              <div className="flex justify-between">
                <span>Refund Amount Requested:</span>
                <span className="text-red-700 font-extrabold text-sm">₹{Number(selectedRefund?.amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer Name:</span>
                <span>{selectedRefund?.orders?.addresses?.full_name || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Internal Assessment Notes</Label>
              <Textarea
                id="notes"
                placeholder="Document your review notes (reasons for rejection/approval)..."
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                className="rounded-xl border-gray-200 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => handleProcessRefund(false)}
              className="rounded-xl font-bold"
            >
              Reject Claim
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button
                onClick={() => handleProcessRefund(true)}
                className="bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold"
              >
                Approve & Refund
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
