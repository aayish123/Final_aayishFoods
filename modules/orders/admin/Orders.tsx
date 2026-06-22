import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search, ShoppingBag, Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useOrdersList } from '@/shared/hooks/useOrdersList';
import { useQueryClient } from '@tanstack/react-query';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  product_name_snapshot?: string | null;
  variant_name_snapshot?: string | null;
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
  updated_at: string;
  notes: string | null;
  user_id: string | null;
  tracking_number?: string | null;
  courier_partner?: string | null;
  dispatch_date?: string | null;
  addresses: {
    full_name: string;
    phone: string;
    city: string;
    pincode: string;
  } | null;
  order_items: OrderItem[];
}

interface DeliveryZone {
  pincode: string;
  name: string;
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // React Query hook
  const { data: ordersResult, isLoading: loading, refetch: refetchOrders } = useOrdersList({
    page: currentPage,
    pageSize,
    statusFilter,
    searchTerm
  });

  useEffect(() => {
    fetchDeliveryZones();

    // PostgreSQL Realtime updates channel setup
    const ordersChannel = supabase
      .channel('orders-admin-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [queryClient]);

  const fetchDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('pincode, name');
      if (!error && data) {
        setZones(data);
      }
    } catch (err) {
      console.error('Error fetching delivery zones:', err);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'confirmed':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'preparing':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'packed':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'shipped':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'delivered':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'returned':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'refunded':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'payment_review':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string | null) => {
    if (!status) return 'Pending';
    if (status === 'preparing') return 'Processing';
    if (status === 'shipped') return 'Shipped';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const orders: Order[] = (ordersResult?.data || []).map((o: any) => ({
    id: o.id,
    total_amount: o.total_amount,
    status: o.status,
    payment_status: o.payment_status,
    created_at: o.created_at,
    updated_at: o.updated_at,
    notes: o.notes,
    user_id: o.user_id,
    tracking_number: o.tracking_number,
    courier_partner: o.courier_partner,
    dispatch_date: o.dispatch_date,
    addresses: o.addresses,
    order_items: o.order_items || []
  }));

  const totalCount = ordersResult?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // CSV Exporter (fetches matching subset)
  const handleExportCSV = () => {
    if (orders.length === 0) {
      toast.warning('No orders found to export');
      return;
    }

    const headers = ['Order ID', 'Customer Name', 'Phone', 'Date', 'Amount (INR)', 'Payment Status', 'Order Status', 'Delivery Zone', 'Pincode'];
    
    const rows = orders.map(o => {
      const zoneName = zones.find(z => z.pincode === o.addresses?.pincode)?.name || 'Out of Zone';
      return [
        o.id,
        o.addresses?.full_name || 'N/A',
        o.addresses?.phone || 'N/A',
        new Date(o.created_at).toLocaleString(),
        o.total_amount,
        o.payment_status || 'Pending',
        o.status || 'Pending',
        zoneName,
        o.addresses?.pincode || 'N/A'
      ];
    });

    const csvString = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aayish_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Orders list exported to CSV successfully');
  };

  // Reset pagination on status filter change
  const handleStatusFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Order Logs</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor sales incoming queues, shipment statuses, and client notes</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleExportCSV} variant="outline" className="h-11 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shrink-0">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => refetchOrders()} variant="outline" className="h-11 border-[#1a3b2b]/30 text-[#1a3b2b] bg-white hover:bg-[#fdfbf7]" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200">
        {[
          { label: 'All Orders', value: 'all' },
          { label: 'Pending', value: 'pending' },
          { label: 'Processing', value: 'processing' },
          { label: 'Packed', value: 'packed' },
          { label: 'Shipped', value: 'shipped' },
          { label: 'Delivered', value: 'delivered' },
          { label: 'Cancelled', value: 'cancelled' },
          { label: 'Returned', value: 'returned' },
          { label: 'Refunded', value: 'refunded' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusFilterChange(tab.value)}
            className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all -mb-[2px] ${
              statusFilter === tab.value
                ? 'border-[#1a3b2b] text-[#1a3b2b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#1a3b2b]/5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by ID, Customer name, Phone, Pincode..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 rounded-xl border-gray-200 bg-white"
            />
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Order Details</th>
                  <th className="px-6 py-4">Client Name</th>
                  <th className="px-6 py-4">Delivery Zone</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 font-medium">
                      Loading orders queue from Supabase...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No matching orders in this queue.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const zoneName = zones.find(z => z.pincode === o.addresses?.pincode)?.name || 'Out of Zone';
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-900 font-semibold">
                          <div className="flex items-center space-x-1">
                            <ShoppingBag className="h-4 w-4 text-gray-400 shrink-0" />
                            <span>#{o.id.slice(-8).toUpperCase()}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {new Date(o.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900 leading-tight">{o.addresses?.full_name || 'N/A'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{o.addresses?.phone || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-700 leading-tight">{zoneName}</p>
                          <p className="text-[10px] font-mono text-gray-400 mt-0.5">{o.addresses?.pincode || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={`capitalize text-[10px] font-bold ${o.payment_status === 'completed' || o.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {o.payment_status || 'Pending'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={`capitalize text-[10px] font-bold ${getStatusColor(o.status)}`}>
                            {formatStatus(o.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">₹{Number(o.total_amount).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/admin/orders/${o.id}`)}
                            className="h-8 w-8 text-[#1a3b2b] hover:bg-gray-100"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination interface */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-[#fdfbf7]/50">
              <span className="text-xs text-gray-500 font-bold uppercase">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-gray-200 h-8 text-xs shrink-0"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-gray-200 h-8 text-xs shrink-0"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
