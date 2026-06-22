import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  Crown,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useCustomersList, useCustomerSegmentCounts } from '@/shared/hooks/useCustomersList';

interface CustomerCalculated {
  id: string;
  full_name: string;
  phone: string;
  provider: string;
  created_at: string;
  ordersCount: number;
  ltv: number;
  lastOrderDate: string | null;
  segment: 'VIP' | 'High Value' | 'Active' | 'Inactive' | 'Dormant' | 'Regular';
}

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // React Query Hooks
  const { data: responseData, isLoading: loading, refetch } = useCustomersList(currentPage, pageSize, debouncedSearch, segmentFilter) as any;
  const { data: segmentCounts } = useCustomerSegmentCounts() as any;

  const rawCustomers = responseData?.data || [];
  const totalCount = responseData?.count || 0;

  const vipCount = segmentCounts?.vip || 0;
  const highValueCount = segmentCounts?.highValue || 0;
  const activeCount = segmentCounts?.active || 0;
  const dormantCount = segmentCounts?.dormant || 0;

  const getSegmentStyles = (segment: string) => {
    switch (segment) {
      case 'VIP':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'High Value':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Active':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'Inactive':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'Dormant':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const paginated: CustomerCalculated[] = rawCustomers.map((c: any) => ({
    id: c.customer_id,
    full_name: c.full_name || 'Anonymous User',
    phone: c.phone || 'N/A',
    provider: c.provider || 'email',
    created_at: c.created_at,
    ordersCount: c.completed_orders_count || 0,
    ltv: Number(c.lifetime_value || 0),
    lastOrderDate: c.last_order_date,
    segment: c.segment || 'Regular'
  }));

  // Pagination calculation
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSegmentFilterChange = (segment: string) => {
    setSegmentFilter(segment);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Customer Index</h1>
          <p className="text-gray-500 text-sm mt-1">Review user accounts, lifecycle segmentation, and purchasing stats.</p>
        </div>

        <Button onClick={() => refetch()} variant="outline" className="border-gray-200 bg-white hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Sync Customers
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VIP Customers</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{vipCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-700">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">High Value</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{highValueCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-green-50 rounded-xl text-green-700">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active (30d)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-red-50 rounded-xl text-red-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dormant (180d+)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{dormantCount}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segment Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200">
        {[
          { label: 'All Registered', value: 'all' },
          { label: 'VIP Status', value: 'vip' },
          { label: 'High Value', value: 'high value' },
          { label: 'Active', value: 'active' },
          { label: 'Inactive (90d+)', value: 'inactive' },
          { label: 'Dormant (180d+)', value: 'dormant' },
          { label: 'Regular', value: 'regular' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleSegmentFilterChange(tab.value)}
            className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition-all -mb-[2px] ${
              segmentFilter === tab.value
                ? 'border-[#1a3b2b] text-[#1a3b2b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Card */}
      <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#1a3b2b]/5 flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone, or id..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 rounded-xl border-gray-200 bg-white"
            />
          </div>
          <Users className="h-5 w-5 text-[#1a3b2b]" />
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Customer Details</th>
                  <th className="px-6 py-4">Phone & Provider</th>
                  <th className="px-6 py-4">Total Orders</th>
                  <th className="px-6 py-4 font-mono">LTV (INR)</th>
                  <th className="px-6 py-4">Last Activity</th>
                  <th className="px-6 py-4">Segment</th>
                  <th className="px-6 py-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && rawCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 font-medium">
                      Syncing registered users queue...
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No customer profiles fit the filters.
                    </td>
                  </tr>
                ) : (
                  paginated.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-9 w-9 rounded-xl bg-[#fdfbf7] border border-[#1a3b2b]/15 text-[#1a3b2b] flex items-center justify-center font-bold text-xs">
                            {c.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{c.full_name}</p>
                            <span className="text-[10px] text-gray-400 mt-1 block">Joined: {new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-700 leading-tight">{c.phone}</p>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mt-0.5 capitalize">{c.provider} auth</span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-bold">{c.ordersCount} completed</td>
                      <td className="px-6 py-4 text-gray-900 font-bold font-mono">₹{c.ltv.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'No Orders'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`capitalize text-[9px] font-bold ${getSegmentStyles(c.segment)}`}>
                          {c.segment}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/admin/customers/${c.id}`)}
                          className="h-8 w-8 text-[#1a3b2b] hover:bg-gray-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
                  className="rounded-lg border-gray-200 h-8 text-xs"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-gray-200 h-8 text-xs"
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
