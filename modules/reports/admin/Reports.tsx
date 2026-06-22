import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar 
} from 'recharts';
import { 
  FileBarChart2, Calendar, Download, RefreshCw, TrendingUp, 
  ShoppingBag, HelpCircle, AlertTriangle, Users, Ticket, Warehouse 
} from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#1a3b2b', '#d4af37', '#5c2018', '#f59e0b', '#3b82f6', '#10b981'];

interface DateRange {
  start: string;
  end: string;
}

interface MovementRecord {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  warehouses: { name: string } | null;
  food_item_variants: { name: string; sku: string } | null;
}

interface CouponStat {
  id: string;
  code: string;
  campaign: string;
  type: string;
  usages: number;
  discountGiven: number;
  revenue: number;
  aov: number;
}

interface StockLevelItem {
  quantity: number;
  reorder_level: number | null;
  warehouses: { name: string } | null;
  food_item_variants: { price: number; name: string; sku: string } | null;
}

export default function AdminReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'inventory', 'coupons', 'customers'
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'custom'>('7days');
  const [customRange, setCustomRange] = useState<DateRange>({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Computed Date Range
  const [activeRange, setActiveRange] = useState<DateRange>({ start: '', end: '' });
  const [queryMode, setQueryMode] = useState<'live' | 'snapshots'>('live');

  // REPORT DATA STATES
  // 1. Sales
  const [salesKPIs, setSalesKPIs] = useState({
    revenue: 0,
    orders: 0,
    aov: 0,
    refunds: 0,
    delivered: 0,
    cancelled: 0
  });
  const [salesTimeline, setSalesTimeline] = useState<{ name: string; sales: number }[]>([]);

  // 2. Inventory
  const [inventoryKPIs, setInventoryKPIs] = useState({
    stockValuation: 0,
    lowStockCount: 0,
    totalVariants: 0,
    movementCount: 0
  });
  const [warehouseStocks, setWarehouseStocks] = useState<{ name: string; value: number }[]>([]);
  const [recentMovements, setRecentMovements] = useState<MovementRecord[]>([]);

  // 3. Coupons
  const [couponStats, setCouponStats] = useState<CouponStat[]>([]);

  // 4. Customers
  const [customerKPIs, setCustomerKPIs] = useState({
    newCustomers: 0,
    repeatRate: 0,
    vipCount: 0,
    dormantCount: 0,
    avgLtv: 0
  });
  const [customerSegments, setCustomerSegments] = useState<{ name: string; value: number }[]>([]);
  const [customerGrowth, setCustomerGrowth] = useState<{ name: string; registrations: number }[]>([]);

  useEffect(() => {
    calculateRanges();
  }, [dateFilter, customRange]);

  useEffect(() => {
    if (activeRange.start && activeRange.end) {
      fetchReportData();
    }
  }, [activeRange, activeTab, queryMode]);

  const calculateRanges = () => {
    const end = new Date();
    const start = new Date();

    if (dateFilter === 'today') {
      start.setHours(0, 0, 0, 0);
      setQueryMode('live');
    } else if (dateFilter === '7days') {
      start.setDate(end.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      setQueryMode('live');
    } else if (dateFilter === '30days') {
      start.setDate(end.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      setQueryMode('live');
    } else if (dateFilter === 'custom') {
      if (!customRange.start || !customRange.end) return;
      const customStart = new Date(customRange.start);
      const customEnd = new Date(customRange.end);
      
      const diffTime = Math.abs(customEnd.getTime() - customStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate live for ranges <= 30 days, load from report_snapshots for quarterly/yearly
      if (diffDays <= 30) {
        setQueryMode('live');
      } else {
        setQueryMode('snapshots');
      }

      setActiveRange({
        start: customStart.toISOString(),
        end: customEnd.toISOString()
      });
      return;
    }

    setActiveRange({
      start: start.toISOString(),
      end: end.toISOString()
    });
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        await fetchSalesReport();
      } else if (activeTab === 'inventory') {
        await fetchInventoryReport();
      } else if (activeTab === 'coupons') {
        await fetchCouponReport();
      } else if (activeTab === 'customers') {
        await fetchCustomerReport();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to compile report metrics: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  // SALES REPORTING LOGIC
  const fetchSalesReport = async () => {
    // Call RPC get_sales_report_kpis
    const { data: kpiData, error: kpiErr } = await (supabase as any)
      .rpc('get_sales_report_kpis', {
        p_start_date: activeRange.start,
        p_end_date: activeRange.end
      });

    if (kpiErr) throw kpiErr;

    if (kpiData && kpiData.length > 0) {
      const kpi = kpiData[0];
      setSalesKPIs({
        revenue: Number(kpi.revenue || 0),
        orders: Number(kpi.orders || 0),
        aov: Number(kpi.aov || 0),
        refunds: Number(kpi.refunds || 0),
        delivered: Number(kpi.delivered || 0),
        cancelled: Number(kpi.cancelled || 0)
      });
    }

    // Call RPC get_sales_report_timeline
    const { data: timelineData, error: timelineErr } = await (supabase as any)
      .rpc('get_sales_report_timeline', {
        p_start_date: activeRange.start,
        p_end_date: activeRange.end
      });

    if (timelineErr) throw timelineErr;

    const timelinePoints = (timelineData || []).map((t: any) => ({
      name: new Date(t.timeline_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      sales: Number(t.sales || 0)
    }));
    setSalesTimeline(timelinePoints);
  };

  // INVENTORY REPORTING LOGIC
  const fetchInventoryReport = async () => {
    // Call RPC get_inventory_report_kpis
    const { data: kpiData, error: kpiErr } = await (supabase as any)
      .rpc('get_inventory_report_kpis', {
        p_start_date: activeRange.start,
        p_end_date: activeRange.end
      });

    if (kpiErr) throw kpiErr;

    if (kpiData && kpiData.length > 0) {
      const kpi = kpiData[0];
      setInventoryKPIs({
        stockValuation: Number(kpi.stock_valuation || 0),
        lowStockCount: Number(kpi.low_stock_count || 0),
        totalVariants: Number(kpi.total_variants || 0),
        movementCount: Number(kpi.movement_count || 0)
      });
    }

    // Call RPC get_warehouse_stocks
    const { data: whData, error: whErr } = await (supabase as any)
      .rpc('get_warehouse_stocks');

    if (whErr) throw whErr;
    setWarehouseStocks(whData || []);

    // Fetch movements (up to 100 limit instead of all movements)
    const { data: movementsData, error: movementsErr } = await supabase
      .from('inventory_movements')
      .select(`
        *,
        warehouses(name),
        food_item_variants(name, sku)
      `)
      .gte('created_at', activeRange.start)
      .lte('created_at', activeRange.end)
      .order('created_at', { ascending: false })
      .limit(100);

    if (movementsErr) throw movementsErr;
    setRecentMovements(movementsData || []);
  };

  // COUPON REPORTING LOGIC
  const fetchCouponReport = async () => {
    const { data, error } = await (supabase as any)
      .rpc('get_coupon_report', {
        p_start_date: activeRange.start,
        p_end_date: activeRange.end
      });

    if (error) throw error;

    const stats = (data || []).map((c: any) => ({
      id: c.id,
      code: c.code,
      campaign: c.campaign,
      type: c.type,
      usages: Number(c.usages || 0),
      discountGiven: Number(c.discountgiven || 0),
      revenue: Number(c.revenue || 0),
      aov: Number(c.aov || 0)
    }));

    setCouponStats(stats);
  };

  // CUSTOMER REPORTING LOGIC
  const fetchCustomerReport = async () => {
    // 1. Get KPIs
    const { data: kpiData, error: kpiErr } = await (supabase as any)
      .rpc('get_customer_report_kpis', {
        p_start_date: activeRange.start,
        p_end_date: activeRange.end
      });

    if (kpiErr) throw kpiErr;

    if (kpiData && kpiData.length > 0) {
      const kpi = kpiData[0];
      setCustomerKPIs({
        newCustomers: Number(kpi.newcustomers || 0),
        repeatRate: Number(kpi.repeatrate || 0),
        vipCount: Number(kpi.vipcount || 0),
        dormantCount: Number(kpi.dormantcount || 0),
        avgLtv: Number(kpi.avgltv || 0)
      });
    }

    // 2. Get customer segments for Pie Chart
    const { data: segmentData, error: segmentErr } = await (supabase as any)
      .rpc('get_customer_report_segments');

    if (segmentErr) throw segmentErr;
    setCustomerSegments(segmentData || []);

    // 3. Get customer growth timeline
    const { data: growthData, error: growthErr } = await (supabase as any)
      .rpc('get_customer_growth_timeline', {
        p_start_date: activeRange.start,
        p_end_date: activeRange.end
      });

    if (growthErr) throw growthErr;

    const growthTimeline = (growthData || []).map((g: any) => ({
      name: new Date(g.timeline_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      registrations: Number(g.registrations || 0)
    }));
    setCustomerGrowth(growthTimeline);
  };

  // CSV EXPORT LOGIC
  const handleExportCSV = async () => {
    if (!user) return;
    setExporting(true);
    try {
      let csvContent = '';
      const filename = `aayish_${activeTab}_report.csv`;

      // 1. Build CSV content based on activeTab
      if (activeTab === 'sales') {
        csvContent = `Sales Analytics Report\n`;
        csvContent += `Start Date,${activeRange.start.substring(0, 10)}\n`;
        csvContent += `End Date,${activeRange.end.substring(0, 10)}\n\n`;
        csvContent += `Metric,Value\n`;
        csvContent += `Gross Revenue,INR ${salesKPIs.revenue.toFixed(2)}\n`;
        csvContent += `Total Orders,${salesKPIs.orders}\n`;
        csvContent += `Average Order Value,INR ${salesKPIs.aov.toFixed(2)}\n`;
        csvContent += `Refund Amount,INR ${salesKPIs.refunds.toFixed(2)}\n`;
        csvContent += `Delivered Orders,${salesKPIs.delivered}\n`;
        csvContent += `Cancelled Orders,${salesKPIs.cancelled}\n`;
      } else if (activeTab === 'inventory') {
        csvContent = `Inventory Valuation Report\n`;
        csvContent += `Generated At,${new Date().toLocaleString()}\n\n`;
        csvContent += `Warehouse,Variant Name,SKU,Quantity,Reorder Level\n`;
        const { data: fullStock } = await supabase
          .from('inventory_ledger_view' as any)
          .select('quantity, reorder_level, warehouse_name, variant_name, variant_sku');
        (fullStock as any[])?.forEach((item) => {
          csvContent += `"${item.warehouse_name || 'N/A'}","${item.variant_name || 'N/A'}","${item.variant_sku || 'N/A'}",${item.quantity},${item.reorder_level || 'N/A'}\n`;
        });
      } else if (activeTab === 'coupons') {
        csvContent = `Coupon Performance Report\n`;
        csvContent += `Start Date,${activeRange.start.substring(0, 10)}\n`;
        csvContent += `End Date,${activeRange.end.substring(0, 10)}\n\n`;
        csvContent += `Coupon Code,Campaign Name,Redemptions,Total Discount Given,Revenue Contribution,Coupon AOV\n`;
        couponStats.forEach(c => {
          csvContent += `"${c.code}","${c.campaign}",${c.usages},INR ${c.discountGiven.toFixed(2)},INR ${c.revenue.toFixed(2)},INR ${c.aov.toFixed(2)}\n`;
        });
      } else if (activeTab === 'customers') {
        csvContent = `Customer Lifecycle Report\n`;
        csvContent += `Generated At,${new Date().toLocaleString()}\n\n`;
        csvContent += `Metric,Value\n`;
        csvContent += `New Registrations (Range),${customerKPIs.newCustomers}\n`;
        csvContent += `Repeat Purchase Rate,${customerKPIs.repeatRate.toFixed(2)}%\n`;
        csvContent += `VIP Customers Count,${customerKPIs.vipCount}\n`;
        csvContent += `Dormant Customers Count,${customerKPIs.dormantCount}\n`;
        csvContent += `Average Customer LTV,INR ${customerKPIs.avgLtv.toFixed(2)}\n`;
      }

      // 2. Insert record into public.report_exports table
      const { error: exportErr } = await supabase
        .from('report_exports' as any)
        .insert({
          user_id: user.id,
          report_type: activeTab,
          filters: {
            date_filter: dateFilter,
            start_date: activeRange.start,
            end_date: activeRange.end,
            query_mode: queryMode
          }
        } as any);

      if (exportErr) throw exportErr;

      // 3. Trigger browser download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${activeTab.replace(/\b\w/g, c => c.toUpperCase())} report exported successfully.`);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to export CSV: ' + errMsg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-xs font-semibold">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Reports & Exports</h1>
          <p className="text-gray-500 text-sm mt-1">Compile sales totals, stock valuation ledger, coupon campaign ROI, and customer retention metrics</p>
        </div>
        
        <div className="flex gap-2 shrink-0">
          <Button 
            onClick={fetchReportData} 
            variant="outline" 
            className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Recalculate
          </Button>
          <Button 
            onClick={handleExportCSV} 
            disabled={exporting}
            className="bg-[#1a3b2b] hover:bg-[#122b1f] text-[#d4af37] font-bold rounded-xl h-10 px-4 flex items-center gap-1.5 shadow-md"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export CSV Ledger'}
          </Button>
        </div>
      </div>

      {/* Query Filter and Date Selector Bar */}
      <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
          {/* Quick filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Today', value: 'today' },
              { label: 'Last 7 Days', value: '7days' },
              { label: 'Last 30 Days', value: '30days' },
              { label: 'Custom Range', value: 'custom' }
            ].map(f => (
              <Button
                key={f.value}
                onClick={() => setDateFilter(f.value as 'today' | '7days' | '30days' | 'custom')}
                variant={dateFilter === f.value ? 'default' : 'outline'}
                className={`rounded-xl px-4 h-9 ${
                  dateFilter === f.value 
                    ? 'bg-[#1a3b2b] text-[#d4af37] hover:bg-[#1a3b2b]' 
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Date Picker (visible when custom range is selected) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="space-y-1">
                <Label htmlFor="start-d" className="text-[10px] text-gray-400 font-bold uppercase block">Start Date</Label>
                <Input
                  id="start-d"
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="h-9 border-gray-200 rounded-xl text-xs w-36"
                />
              </div>
              <span className="text-gray-400 font-bold mt-4 font-mono">to</span>
              <div className="space-y-1">
                <Label htmlFor="end-d" className="text-[10px] text-gray-400 font-bold uppercase block">End Date</Label>
                <Input
                  id="end-d"
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="h-9 border-gray-200 rounded-xl text-xs w-36"
                />
              </div>
            </div>
          )}

          {/* Active Query details */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-0.5 self-stretch justify-center md:self-auto">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Query Calculation Mode:</span>
            <div className="flex items-center gap-2">
              <Badge className={queryMode === 'live' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}>
                {queryMode === 'live' ? 'Dynamic Realtime' : 'Pre-computed Snapshots'}
              </Badge>
              <span className="text-[10px] text-gray-500 font-mono">
                {new Date(activeRange.start).toLocaleDateString()} - {new Date(activeRange.end).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Tabs Container */}
      <Tabs defaultValue="sales" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#1a3b2b]/5 border border-[#1a3b2b]/10 p-1 rounded-2xl w-fit">
          <TabsTrigger value="sales" className="rounded-xl px-5 h-9 data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
            <TrendingUp className="h-4 w-4 mr-2" /> Sales Reports
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-xl px-5 h-9 data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
            <Warehouse className="h-4 w-4 mr-2" /> Inventory & Stock
          </TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-xl px-5 h-9 data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
            <Ticket className="h-4 w-4 mr-2" /> Coupons Performance
          </TabsTrigger>
          <TabsTrigger value="customers" className="rounded-xl px-5 h-9 data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
            <Users className="h-4 w-4 mr-2" /> Customer Segments
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SALES REPORTS */}
        <TabsContent value="sales" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Gross Sales</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">₹{salesKPIs.revenue.toLocaleString()}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total Orders</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">{salesKPIs.orders}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">AOV</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">₹{salesKPIs.aov.toFixed(2)}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Refund Amount</span>
              <h4 className="text-xl font-bold text-red-600 mt-1">₹{salesKPIs.refunds.toLocaleString()}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Delivered</span>
              <h4 className="text-xl font-bold text-emerald-600 mt-1">{salesKPIs.delivered}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Cancelled</span>
              <h4 className="text-xl font-bold text-gray-400 mt-1">{salesKPIs.cancelled}</h4>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-gray-50 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-base font-bold">Revenue Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-72 w-full">
                {salesTimeline.length === 0 ? (
                  <p className="text-center py-20 text-gray-400">No transactions recorded inside filters.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSalesTab" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a3b2b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#1a3b2b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} contentStyle={{ background: '#fff', border: '1px solid #1a3b2b10', borderRadius: '12px', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="sales" stroke="#1a3b2b" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesTab)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: INVENTORY REPORTS */}
        <TabsContent value="inventory" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Aggregate Stock Valuation</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">₹{inventoryKPIs.stockValuation.toLocaleString()}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Low Stock Warnings</span>
              <h4 className={`text-xl font-bold mt-1 ${inventoryKPIs.lowStockCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{inventoryKPIs.lowStockCount}</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total Catalog Items</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">{inventoryKPIs.totalVariants} variants</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Movements Logged (Range)</span>
              <h4 className="text-xl font-bold text-[#5c2018] mt-1">{inventoryKPIs.movementCount} transfers</h4>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Warehouse stock split pie chart */}
            <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-1">
              <CardHeader className="border-b border-gray-50 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-base font-bold">Warehouse Stock Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col justify-between items-center h-72">
                <div className="h-44 w-full">
                  {warehouseStocks.length === 0 ? (
                    <p className="text-center py-10 text-gray-400">No stock entries loaded.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={warehouseStocks}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {warehouseStocks.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-[10px] font-semibold text-gray-600">
                  {warehouseStocks.map((item, idx) => (
                    <div key={item.name} className="flex items-center space-x-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate">{item.name}:</span>
                      <span className="font-bold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Movements history */}
            <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-2">
              <CardHeader className="border-b border-gray-50 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-base font-bold">Recent Stock Movements</CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead className="py-2.5 pl-6">Type</TableHead>
                      <TableHead className="py-2.5">Warehouse</TableHead>
                      <TableHead className="py-2.5">Variant</TableHead>
                      <TableHead className="py-2.5">Qty</TableHead>
                      <TableHead className="py-2.5 pr-6 text-right">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-gray-400">
                          No movements logged inside active timeline filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentMovements.slice(0, 10).map(m => (
                        <TableRow key={m.id} className="hover:bg-gray-50/30">
                          <TableCell className="py-2.5 pl-6 capitalize font-bold text-[#1a3b2b]">{m.type}</TableCell>
                          <TableCell className="py-2.5 text-gray-500">{m.warehouses?.name || 'N/A'}</TableCell>
                          <TableCell className="py-2.5 text-gray-900 font-bold">{m.food_item_variants?.name || 'Product'}</TableCell>
                          <TableCell className="py-2.5 font-bold">{m.quantity} units</TableCell>
                          <TableCell className="py-2.5 pr-6 text-right text-gray-400 truncate max-w-[120px]">{m.reason || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: COUPON PERFORMANCE */}
        <TabsContent value="coupons" className="space-y-6 focus-visible:outline-none">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-50 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-base font-bold">Coupon Usage Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="px-6 py-3.5">Coupon Code</TableHead>
                    <TableHead className="py-3.5">Campaign Name</TableHead>
                    <TableHead className="py-3.5">Coupon Type</TableHead>
                    <TableHead className="py-3.5 text-center">Usages (Range)</TableHead>
                    <TableHead className="py-3.5">Discount Given</TableHead>
                    <TableHead className="py-3.5">Revenue Contribution</TableHead>
                    <TableHead className="py-3.5 pr-6 text-right">Coupon AOV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {couponStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-gray-400">
                        No coupon redemptions compiled inside filter dates.
                      </TableCell>
                    </TableRow>
                  ) : (
                    couponStats.map(c => (
                      <TableRow key={c.id} className="hover:bg-gray-50/30 font-medium text-gray-700">
                        <TableCell className="px-6 py-3.5">
                          <span className="font-mono border border-dashed border-[#d4af37]/60 bg-[#d4af37]/5 px-2 py-0.5 rounded text-gray-900 font-bold">
                            {c.code}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-900 font-bold">{c.campaign}</TableCell>
                        <TableCell className="capitalize text-xs text-gray-500">{c.type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-center font-bold text-gray-900">{c.usages}</TableCell>
                        <TableCell className="text-[#5c2018] font-bold">₹{c.discountGiven.toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-600 font-bold">₹{c.revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right pr-6 font-bold text-gray-800">₹{c.aov.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CUSTOMER SEGMENTS */}
        <TabsContent value="customers" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">New Signups (Range)</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">{customerKPIs.newCustomers} registrations</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Repeat Purchase Rate</span>
              <h4 className="text-xl font-bold text-emerald-600 mt-1">{customerKPIs.repeatRate.toFixed(2)}%</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">VIP Customers (&ge; ₹10k LTV)</span>
              <h4 className="text-xl font-bold text-amber-600 mt-1">{customerKPIs.vipCount} buyers</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Dormant (&gt; 90 days idle)</span>
              <h4 className="text-xl font-bold text-red-600 mt-1">{customerKPIs.dormantCount} buyers</h4>
            </Card>
            <Card className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Avg Customer LTV</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1">₹{customerKPIs.avgLtv.toFixed(0)}</h4>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer segments distribution */}
            <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-1">
              <CardHeader className="border-b border-gray-50 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-base font-bold">Segment Shares</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col justify-between items-center h-72">
                <div className="h-44 w-full">
                  {customerSegments.length === 0 ? (
                    <p className="text-center py-10 text-gray-400">No buyer segments aggregated.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={customerSegments}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {customerSegments.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-[10px] font-semibold text-gray-600">
                  {customerSegments.map((item, idx) => (
                    <div key={item.name} className="flex items-center space-x-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate">{item.name}:</span>
                      <span className="font-bold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer registrations line chart */}
            <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-2">
              <CardHeader className="border-b border-gray-50 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-base font-bold">New Registrations Growth</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={customerGrowth} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #1a3b2b10', borderRadius: '12px', fontSize: '10px' }} />
                      <Line type="monotone" dataKey="registrations" stroke="#d4af37" strokeWidth={2} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
