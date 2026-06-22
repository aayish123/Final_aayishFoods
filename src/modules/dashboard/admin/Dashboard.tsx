import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package2,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Truck,
  Ticket,
  Sliders,
  DollarSign,
  Percent,
  Warehouse,
  AlertOctagon,
  CalendarCheck
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockItems: number;
  criticalAlerts: number;
  activeCoupons: number;
  activeBanners: number;
  pendingRefunds: number;
  totalWarehouses: number;
  redemptionsToday: number;
  bannerCtr: number;
  // Financial KPIs
  revenueToday: number;
  revenueThisMonth: number;
  newCustomers: number;
  repeatPurchaseRate: number;
  inventoryValue: number;
  refundRate: number;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  user_id: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

const COLORS = ['#d4af37', '#1a3b2b', '#5c2018', '#f59e0b', '#ef4444', '#10b981'];

interface SalesDataPoint {
  name: string;
  sales: number;
}

interface StatusDataPoint {
  name: string;
  value: number;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    totalProducts: 0,
    lowStockItems: 0,
    criticalAlerts: 0,
    activeCoupons: 0,
    activeBanners: 0,
    pendingRefunds: 0,
    totalWarehouses: 0,
    redemptionsToday: 0,
    bannerCtr: 0,
    revenueToday: 0,
    revenueThisMonth: 0,
    newCustomers: 0,
    repeatPurchaseRate: 0,
    inventoryValue: 0,
    refundRate: 0
  });
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDataPoint[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetchDashboardData();

    // Set up realtime subscriptions to update KPIs instantly (Orders & Notifications only)
    const channel = supabase
      .channel('dashboard-realtime-kpis')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchDashboardData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_refunds' },
        () => {
          fetchDashboardData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchDashboardData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();

      // 1. Fetch Orders and Revenue (with user_id for repeat customer analysis)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, status, created_at, user_id');

      if (ordersError) throw ordersError;

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((acc, order) => acc + Number(order.total_amount || 0), 0) || 0;

      // 2. Fetch Customers Count & Registered Profiles (to calculate new customers in last 30D)
      const { data: profiles, error: customerError } = await supabase
        .from('profiles')
        .select('created_at, role')
        .eq('role', 'user');

      if (customerError) throw customerError;

      const totalCustomers = profiles?.length || 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newCustomers = profiles?.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length || 0;

      // 3. Fetch Products Count
      const { count: productsCount, error: productError } = await supabase
        .from('food_items')
        .select('*', { count: 'exact', head: true });

      if (productError) throw productError;

      // 4. Fetch Stock levels for low stock, critical stock, and inventory valuation calculations
      const { data: stockLevels, error: stockError } = await supabase
        .from('warehouse_stock')
        .select(`
          quantity, 
          reorder_level,
          food_item_variants(price)
        `);

      if (stockError) throw stockError;

      const lowStockItems = stockLevels?.filter(
        s => s.reorder_level !== null && s.quantity <= s.reorder_level
      ).length || 0;

      const criticalAlerts = stockLevels?.filter(
        s => s.quantity <= 2
      ).length || 0;

      // Calculate total inventory valuation based on variant price * quantity
      const inventoryValue = stockLevels?.reduce((acc, item) => {
        const price = item.food_item_variants?.price || 0;
        return acc + (item.quantity * price);
      }, 0) || 0;

      // 5. Fetch Coupons for active coupons calculation
      const { data: coupons, error: couponsError } = await supabase
        .from('coupons')
        .select('is_active, start_date, end_date, usage_limit, usage_count');

      if (couponsError) throw couponsError;

      const activeCoupons = coupons?.filter(c => {
        if (!c.is_active) return false;
        if (c.start_date && new Date(c.start_date) > now) return false;
        if (c.end_date && new Date(c.end_date) < now) return false;
        if (c.usage_limit !== null && c.usage_count >= c.usage_limit) return false;
        return true;
      }).length || 0;

      // 6. Fetch Banners for active banners calculation
      const { data: banners, error: bannersError } = await supabase
        .from('banners')
        .select('is_active, start_date, end_date');

      if (bannersError) throw bannersError;

      const activeBanners = banners?.filter(b => {
        if (!b.is_active) return false;
        if (b.start_date && new Date(b.start_date) > now) return false;
        if (b.end_date && new Date(b.end_date) < now) return false;
        return true;
      }).length || 0;

      // 7. Fetch Pending Refunds count
      const { count: pendingRefundsCount, error: refundsError } = await supabase
        .from('order_refunds')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (refundsError) throw refundsError;

      // 8. Fetch Total Warehouses count
      const { count: warehousesCount, error: warehousesError } = await supabase
        .from('warehouses')
        .select('*', { count: 'exact', head: true });

      if (warehousesError) throw warehousesError;

      // 9. Fetch Coupon Redemptions today
      const todayStr = now.toISOString().split('T')[0];
      const { data: redemptionsToday, error: redemptionsError } = await supabase
        .from('coupon_redemptions')
        .select('id')
        .gte('created_at', `${todayStr}T00:00:00Z`);

      if (redemptionsError) throw redemptionsError;

      // 10. Fetch Banner CTR
      const { data: bannerEvents, error: bannerEventsError } = await supabase
        .from('banner_analytics')
        .select('event_type');

      if (bannerEventsError) throw bannerEventsError;

      const bannerViews = bannerEvents?.filter(e => e.event_type === 'view').length || 0;
      const bannerClicks = bannerEvents?.filter(e => e.event_type === 'click').length || 0;
      const bannerCtr = bannerViews > 0 ? (bannerClicks / bannerViews) * 100 : 0;

      // 11. Calculate Financial indicators
      // A. Revenue Today
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const revenueToday = orders?.filter(o => new Date(o.created_at) >= startOfToday)
        .reduce((acc, o) => acc + Number(o.total_amount || 0), 0) || 0;

      // B. Revenue This Month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const revenueThisMonth = orders?.filter(o => new Date(o.created_at) >= startOfMonth)
        .reduce((acc, o) => acc + Number(o.total_amount || 0), 0) || 0;

      // C. Repeat Purchase Rate
      const customerOrderCounts: Record<string, number> = {};
      orders?.forEach(o => {
        if (o.user_id) {
          customerOrderCounts[o.user_id] = (customerOrderCounts[o.user_id] || 0) + 1;
        }
      });
      const totalPurchasingCustomers = Object.keys(customerOrderCounts).length;
      const repeatPurchasingCustomers = Object.values(customerOrderCounts).filter(count => count >= 2).length;
      const repeatPurchaseRate = totalPurchasingCustomers > 0 ? (repeatPurchasingCustomers / totalPurchasingCustomers) * 100 : 0;

      // D. Refund Rate
      const refundedOrdersCount = orders?.filter(o => o.status === 'refunded').length || 0;
      const refundRate = totalOrders > 0 ? (refundedOrdersCount / totalOrders) * 100 : 0;

      setStats({
        totalOrders,
        totalRevenue,
        totalCustomers: totalCustomers || 0,
        totalProducts: productsCount || 0,
        lowStockItems,
        criticalAlerts,
        activeCoupons,
        activeBanners,
        pendingRefunds: pendingRefundsCount || 0,
        totalWarehouses: warehousesCount || 0,
        redemptionsToday: redemptionsToday?.length || 0,
        bannerCtr,
        revenueToday,
        revenueThisMonth,
        newCustomers,
        repeatPurchaseRate,
        inventoryValue,
        refundRate
      });

      // 12. Build Sales chart timeline
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const salesTimeline = last7Days.map(date => {
        const dayOrders = orders?.filter(o => o.created_at.startsWith(date)) || [];
        const sum = dayOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
        return {
          name: new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
          sales: sum,
        };
      });
      setSalesData(salesTimeline);

      // 13. Build Order status breakdown
      const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
      const statusCounts = statuses.map((status) => {
        const count = orders?.filter(o => o.status === status).length || 0;
        return {
          name: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: count,
        };
      }).filter(item => item.value > 0);
      setStatusData(statusCounts.length ? statusCounts : [{ name: 'No Orders', value: 1 }]);

      // 14. Fetch latest audit logs
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*, profiles:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!logsError) {
        setAuditLogs((logs as AuditLog[]) || []);
      }

    } catch (error) {
      const err = error as Error;
      toast.error(`Dashboard Fetch Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Operational Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time business intelligence and promotions analytics for Aayish Foods</p>
        </div>
        <Button onClick={() => fetchDashboardData()} variant="outline" className="flex items-center gap-2 border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* SECTION 1: Core Financial & Performance KPIs */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5">Financials & Business Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue Today</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">₹{stats.revenueToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                <p className="text-[10px] text-green-600 font-semibold mt-1">Sales completed today</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue This Month</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">₹{stats.revenueThisMonth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                <p className="text-[10px] text-green-600 font-semibold mt-1">Accumulated calendar month</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gross Revenue (LTV)</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">₹{stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">All-time database gross</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New Customers (30D)</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">+{stats.newCustomers}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Registrations in last 30 days</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Repeat Purchase Rate</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.repeatPurchaseRate.toFixed(1)}%</h3>
                <p className="text-[10px] text-indigo-600 font-semibold mt-1">Buyers with &ge; 2 checkouts</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inventory Value</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">₹{stats.inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Total valuation at recipe price</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Warehouse className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Refund Rate</p>
                <h3 className={`text-xl font-bold mt-1 ${stats.refundRate > 5 ? 'text-red-600' : 'text-gray-900'}`}>{stats.refundRate.toFixed(1)}%</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Refunded vs total checkouts</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${stats.refundRate > 5 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-450'}`}>
                <Percent className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Refunds</p>
                <h3 className={`text-xl font-bold mt-1 ${stats.pendingRefunds > 0 ? 'text-[#5c2018]' : 'text-gray-900'}`}>{stats.pendingRefunds}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Awaiting staff review</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${stats.pendingRefunds > 0 ? 'bg-[#5c2018]/10 text-[#5c2018]' : 'bg-gray-50 text-gray-400'}`}>
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* SECTION 2: Marketing & Promotions KPIs */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5">Promotions & Marketing Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Coupons</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.activeCoupons}</h3>
                <p className="text-[10px] text-[#d4af37] font-semibold mt-1">Live active discount campaigns</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center text-[#d4af37]">
                <Ticket className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Redemptions Today</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.redemptionsToday}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Coupon codes applied today</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Banners</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.activeBanners}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Scheduled homepage/menu ads</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                <Sliders className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ad Banner CTR %</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.bannerCtr.toFixed(2)}%</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Impressions to click-through</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Percent className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3: Logistics & Inventory KPIs */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5">Logistics & Warehouse Audit</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Warehouses</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.totalWarehouses}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Active fulfillment locations</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-[#1a3b2b]/10 flex items-center justify-center text-[#1a3b2b]">
                <Warehouse className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Low Stock Products</p>
                <h3 className={`text-xl font-bold mt-1 ${stats.lowStockItems > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{stats.lowStockItems}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Quantity &le; reorder limit</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${stats.lowStockItems > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Critical Alerts</p>
                <h3 className={`text-xl font-bold mt-1 ${stats.criticalAlerts > 0 ? 'text-rose-600 font-extrabold animate-pulse' : 'text-gray-900'}`}>{stats.criticalAlerts}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Variants with stock &le; 2</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${stats.criticalAlerts > 0 ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-gray-400'}`}>
                <AlertOctagon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Products</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.totalProducts}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-1">Registered catalog recipes</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500">
                <Package2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales Timeline */}
        <Card className="xl:col-span-2 bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-gray-50 px-6 py-4">
            <CardTitle className="font-serif text-[#5c2018] text-lg font-bold">Revenue Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a3b2b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#1a3b2b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} contentStyle={{ background: '#fff', border: '1px solid #1a3b2b10', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="sales" stroke="#1a3b2b" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-gray-50 px-6 py-4">
            <CardTitle className="font-serif text-[#5c2018] text-lg font-bold">Order Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col justify-between items-center h-80">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Status Legend Grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full text-xs">
              {statusData.map((item, idx) => (
                <div key={item.name} className="flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-gray-600 truncate">{item.name}:</span>
                  <span className="font-bold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs & Quick Navigation Controls */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Audit Log Feed */}
        <Card className="xl:col-span-2 bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-gray-50 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-[#5c2018] text-lg font-bold">Recent System Logs</CardTitle>
            <ShieldCheck className="h-5 w-5 text-[#1a3b2b]" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="divide-y divide-gray-100">
              {auditLogs.length ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex justify-between items-center text-sm gap-4">
                    <div>
                      <span className="font-semibold text-[#1a3b2b] capitalize">{log.action}</span>
                      <span className="text-gray-500"> on </span>
                      <span className="font-medium text-gray-900">{log.entity_type}</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">By {log.profiles?.full_name || 'System Auto'}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-sm text-gray-400">No activity logged in database yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Operational Actions */}
        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-gray-50 px-6 py-4">
            <CardTitle className="font-serif text-[#5c2018] text-lg font-bold">Quick Tasks</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <Button asChild className="w-full h-11 justify-start bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold rounded-xl">
              <Link to="/admin/products">
                <PlusCircle className="mr-3 h-5 w-5" />
                Catalog Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-11 justify-start border-gray-200 hover:bg-[#fdfbf7] rounded-xl text-gray-700">
              <Link to="/admin/fulfillment">
                <Truck className="mr-3 h-5 w-5 text-[#5c2018]" />
                Fulfillment Center
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-11 justify-start border-gray-200 hover:bg-[#fdfbf7] rounded-xl text-gray-700">
              <Link to="/admin/inventory">
                <Warehouse className="mr-3 h-5 w-5 text-[#d4af37]" />
                Warehouses & Ledger
              </Link>
            </Button>
            {stats.lowStockItems > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl mt-4">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 animate-pulse" />
                <div className="text-xs">
                  <p className="font-bold text-red-800">Critical Stock Warning</p>
                  <p className="text-red-600 mt-0.5">{stats.lowStockItems} variants under minimum thresholds.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
