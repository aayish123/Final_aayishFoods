import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Ticket, Plus, Search, Edit, Trash2, Calendar, TrendingUp, RefreshCw,
  DollarSign, Percent, User, ArrowUpRight, BarChart2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { useUnsavedChangesGuard } from '@/components/system/UnsavedChangesGuard';
import { useConfirm } from '@/components/common/ConfirmDialog';


interface Coupon {
  id: string;
  code: string;
  type: 'flat' | 'percentage' | 'free_shipping' | 'bogo' | 'referral' | 'birthday' | 'category_specific' | 'product_specific' | 'first_order' | 'festival_campaign';
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  max_uses_per_user: number;
  is_active: boolean;
  category_id: string | null;
  food_item_id: string | null;
  campaign_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface RedemptionDetail {
  id: string;
  discount_amount: number;
  created_at: string;
  user_id: string | null;
  order_id: string;
  orders: {
    total_amount: number;
    status: string | null;
    profiles?: {
      full_name: string | null;
    } | null;
  } | null;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { confirm } = useConfirm();

  useUnsavedChangesGuard(isDirty);

  // Form sheet state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  
  // Form fields
  const [code, setCode] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [type, setType] = useState<Coupon['type']>('flat');
  const [value, setValue] = useState<number>(0);
  const [minOrderAmount, setMinOrderAmount] = useState<string>('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('none');
  const [foodItemId, setFoodItemId] = useState<string>('none');

  // When form sheet is opened or coupon changes, reset isInitialLoad
  useEffect(() => {
    if (isFormOpen) {
      setIsInitialLoad(true);
      setIsDirty(false);
    } else {
      setIsDirty(false);
      window.formIsDirty = false;
    }
  }, [isFormOpen, editingCoupon]);

  // Once details are loaded, set isInitialLoad to false
  useEffect(() => {
    if (isFormOpen) {
      const timer = setTimeout(() => setIsInitialLoad(false), 200);
      return () => clearTimeout(timer);
    }
  }, [code, campaignName, type, value, minOrderAmount, maxDiscountAmount, startDate, endDate, usageLimit, maxUsesPerUser, isActive, categoryId, foodItemId, isFormOpen]);

  // Track if any form state changes after initial load
  useEffect(() => {
    if (isFormOpen && !isInitialLoad) {
      setIsDirty(true);
    }
  }, [code, campaignName, type, value, minOrderAmount, maxDiscountAmount, startDate, endDate, usageLimit, maxUsesPerUser, isActive, categoryId, foodItemId]);

  // Performance Sheet State
  const [isPerfOpen, setIsPerfOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfData, setPerfData] = useState<{
    redemptions: RedemptionDetail[];
    totalRevenue: number;
    totalDiscount: number;
    aov: number;
    usageCount: number;
  }>({
    redemptions: [],
    totalRevenue: 0,
    totalDiscount: 0,
    aov: 0,
    usageCount: 0
  });

  useEffect(() => {
    fetchCoupons();
    fetchCategoriesAndProducts();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCoupons((data as Coupon[]) || []);
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Failed to load coupons: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndProducts = async () => {
    try {
      const { data: catData } = await supabase.from('categories').select('id, name');
      const { data: prodData } = await supabase.from('food_items').select('id, name');
      if (catData) setCategories(catData);
      if (prodData) setProducts(prodData);
    } catch (err) {
      console.error('Error fetching restrictions reference:', err);
    }
  };

  const computeStatus = (coupon: Coupon): 'active' | 'scheduled' | 'expired' | 'exhausted' | 'disabled' => {
    if (!coupon.is_active) return 'disabled';
    
    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      return 'scheduled';
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      return 'expired';
    }
    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      return 'exhausted';
    }
    return 'active';
  };

  const handleOpenForm = (coupon: Coupon | null = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setCode(coupon.code);
      setCampaignName(coupon.campaign_name || '');
      setType(coupon.type);
      setValue(coupon.value);
      setMinOrderAmount(coupon.min_order_amount?.toString() || '');
      setMaxDiscountAmount(coupon.max_discount_amount?.toString() || '');
      setStartDate(coupon.start_date ? coupon.start_date.substring(0, 16) : '');
      setEndDate(coupon.end_date ? coupon.end_date.substring(0, 16) : '');
      setUsageLimit(coupon.usage_limit?.toString() || '');
      setMaxUsesPerUser(coupon.max_uses_per_user);
      setIsActive(coupon.is_active);
      setCategoryId(coupon.category_id || 'none');
      setFoodItemId(coupon.food_item_id || 'none');
    } else {
      setEditingCoupon(null);
      setCode('');
      setCampaignName('');
      setType('flat');
      setValue(0);
      setMinOrderAmount('');
      setMaxDiscountAmount('');
      setStartDate('');
      setEndDate('');
      setUsageLimit('');
      setMaxUsesPerUser(1);
      setIsActive(true);
      setCategoryId('none');
      setFoodItemId('none');
    }
    setIsFormOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !campaignName.trim() || value <= 0) {
      toast.error('Please fill in code, campaign name, and value.');
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      campaign_name: campaignName.trim(),
      type,
      value,
      min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : null,
      max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      usage_limit: usageLimit ? parseInt(usageLimit) : null,
      max_uses_per_user: maxUsesPerUser,
      is_active: isActive,
      category_id: categoryId === 'none' ? null : categoryId,
      food_item_id: foodItemId === 'none' ? null : foodItemId,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', editingCoupon.id);
        if (error) throw error;

        await auditService.log(
          'update',
          'coupon',
          editingCoupon.id,
          editingCoupon as unknown as Record<string, unknown> | null,
          payload as unknown as Record<string, unknown>
        );

        toast.success('Coupon updated successfully!');
      } else {
        const { data: newCoupon, error } = await supabase
          .from('coupons')
          .insert([{ ...payload, usage_count: 0 }])
          .select('id')
          .single();
        if (error) throw error;

        await auditService.log(
          'create',
          'coupon',
          newCoupon.id,
          null,
          payload as unknown as Record<string, unknown>
        );

        toast.success('Coupon created successfully!');
      }
      window.formIsDirty = false;
      setIsDirty(false);
      setIsFormOpen(false);
      fetchCoupons();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Failed to save coupon: ' + error.message);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    confirm({
      title: 'Delete Coupon Campaign',
      message: 'Are you sure you want to permanently delete this coupon campaign? This action is irreversible.',
      confirmText: 'Delete Campaign',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('coupons').delete().eq('id', id);
          if (error) throw error;

          await auditService.log('delete', 'coupon', id, { deleted_id: id }, null);

          toast.success('Coupon deleted successfully.');
          fetchCoupons();
        } catch (err) {
          console.error(err);
          const error = err as Error;
          toast.error('Failed to delete coupon: ' + error.message);
        }
      }
    });
  };

  const handleOpenPerformance = async (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsPerfOpen(true);
    setPerfLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select(`
          id,
          discount_amount,
          created_at,
          user_id,
          order_id,
          orders:order_id (
            total_amount,
            status,
            profiles:user_id (
              full_name
            )
          )
        `)
        .eq('coupon_id', coupon.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = (data || []) as unknown as RedemptionDetail[];

      let totalRevenue = 0;
      let totalDiscount = 0;
      const usageCount = typedData.length;

      typedData.forEach(red => {
        totalDiscount += red.discount_amount;
        if (red.orders) {
          totalRevenue += red.orders.total_amount;
        }
      });

      const aov = usageCount > 0 ? totalRevenue / usageCount : 0;

      setPerfData({
        redemptions: typedData,
        totalRevenue,
        totalDiscount,
        aov,
        usageCount
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      const error = err as Error;
      toast.error('Failed to load performance analytics: ' + error.message);
    } finally {
      setPerfLoading(false);
    }
  };

  // Filter coupons
  const filteredCoupons = coupons.filter(c => {
    const status = computeStatus(c);
    const matchesSearch = c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.campaign_name && c.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50">Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-50">Scheduled</Badge>;
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Expired</Badge>;
      case 'exhausted':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-50">Exhausted</Badge>;
      case 'disabled':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200/50 hover:bg-rose-50">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCouponType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // KPI Calculations
  const totalCount = coupons.length;
  const activeCount = coupons.filter(c => computeStatus(c) === 'active').length;
  const scheduledCount = coupons.filter(c => computeStatus(c) === 'scheduled').length;
  const totalRedemptionsSum = coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Coupon Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">Configure discount values, campaign timelines, and track conversion values</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            onClick={() => { fetchCoupons(); fetchCategoriesAndProducts(); }} 
            variant="outline" 
            className="border-gray-250 bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-xl h-11"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Coupons
          </Button>
          <Button 
            onClick={() => handleOpenForm(null)}
            className="bg-[#1a3b2b] hover:bg-[#122b1f] text-white rounded-xl shadow-md flex items-center gap-2 h-11"
          >
            <Plus className="h-4 w-4" /> Create New Coupon
          </Button>
        </div>
      </div>

      {/* KPI Overview Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Campaigns</span>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{totalCount}</h3>
            </div>
            <div className="bg-[#5c2018]/5 p-3 rounded-xl text-[#5c2018]">
              <Ticket className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Now</span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</h3>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
              <TrendingUp className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Scheduled Campaigns</span>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">{scheduledCount}</h3>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
              <Calendar className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Redemptions</span>
              <h3 className="text-2xl font-bold text-[#d4af37] mt-1">{totalRedemptionsSum}</h3>
            </div>
            <div className="bg-[#d4af37]/5 p-3 rounded-xl text-[#d4af37]">
              <BarChart2 className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table Card */}
      <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <CardTitle className="text-lg font-serif font-bold text-gray-800">Coupon Index</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search code or campaign..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-gray-50/50 border-gray-200 rounded-xl text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#1a3b2b]"
                />
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-gray-50/50 border-gray-200 rounded-xl text-xs h-9 focus:ring-1 focus:ring-[#1a3b2b]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-150">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="exhausted">Exhausted</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>

              {/* Type filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44 bg-gray-50/50 border-gray-200 rounded-xl text-xs h-9 focus:ring-1 focus:ring-[#1a3b2b]">
                  <SelectValue placeholder="Coupon Type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-150">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="flat">Flat Discount</SelectItem>
                  <SelectItem value="percentage">Percentage Discount</SelectItem>
                  <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  <SelectItem value="first_order">First Order Only</SelectItem>
                  <SelectItem value="birthday">Birthday Reward</SelectItem>
                  <SelectItem value="referral">Referral Offer</SelectItem>
                  <SelectItem value="category_specific">Category Restricted</SelectItem>
                  <SelectItem value="product_specific">Product Restricted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-gray-400">Loading coupon campaigns...</div>
          ) : filteredCoupons.length === 0 ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center">
              <Ticket className="h-12 w-12 text-gray-200 mb-2 stroke-1" />
              <p className="font-medium text-sm">No coupons found</p>
              <p className="text-xs text-gray-400 mt-0.5">Try altering filters or create a new campaign</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-600 text-xs px-6 py-4">Campaign & Code</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Discount Type</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Value</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Min Spend</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Redemptions</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Status</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Validity Period</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs text-right px-6 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map(coupon => {
                    const status = computeStatus(coupon);
                    return (
                      <TableRow key={coupon.id} className="hover:bg-gray-50/40 transition-colors">
                        <TableCell className="px-6 py-4 font-medium">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-gray-800">{coupon.campaign_name || 'Unnamed Campaign'}</span>
                            <span className="font-mono text-[11px] font-bold text-[#d4af37] border border-dashed border-[#d4af37]/40 bg-[#d4af37]/5 px-2 py-0.5 rounded w-max">
                              {coupon.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatCouponType(coupon.type)}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-gray-800">
                          {coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {coupon.min_order_amount ? `₹${coupon.min_order_amount}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-gray-700">{coupon.usage_count} redemptions</span>
                            <span className="text-[10px] text-gray-400">
                              Limit: {coupon.usage_limit ? coupon.usage_limit : 'Unlimited'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {getStatusBadge(status)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          <div className="flex flex-col">
                            {coupon.start_date ? (
                              <span>Starts: {new Date(coupon.start_date).toLocaleDateString()}</span>
                            ) : (
                              <span>Instant start</span>
                            )}
                            {coupon.end_date ? (
                              <span>Ends: {new Date(coupon.end_date).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-gray-400">Never expires</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleOpenPerformance(coupon)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-[#d4af37] hover:bg-amber-50 rounded-lg"
                              title="Performance Analytics"
                            >
                              <BarChart2 className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleOpenForm(coupon)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-[#1a3b2b] hover:bg-[#1a3b2b]/5 rounded-lg"
                              title="Edit Coupon"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Coupon"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE & EDIT FORM SHEET */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto rounded-l-2xl border-l border-gray-150 p-6 bg-white">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-xl font-bold text-gray-800">
              {editingCoupon ? 'Edit Coupon Campaign' : 'Create Coupon Campaign'}
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              Set parameters for validation rules, discount percentages or absolute sums, and scope targets.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveCoupon} className="space-y-5 text-xs">
            {/* Coupon Code & Campaign Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-gray-700 font-semibold">Coupon Code *</Label>
                <Input
                  id="code"
                  placeholder="E.g., FESTIVE50"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingCoupon}
                  className="rounded-xl border-gray-200 h-10 uppercase font-mono tracking-wider focus-visible:ring-[#1a3b2b]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaignName" className="text-gray-700 font-semibold">Campaign Name *</Label>
                <Input
                  id="campaignName"
                  placeholder="E.g., Diwali Special Offer"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                  required
                />
              </div>
            </div>

            {/* Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-gray-700 font-semibold">Coupon Type *</Label>
                <Select value={type} onValueChange={(val: Coupon['type']) => setType(val)}>
                  <SelectTrigger id="type" className="rounded-xl border-gray-200 h-10 focus:ring-[#1a3b2b]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-150">
                    <SelectItem value="flat">Flat Discount</SelectItem>
                    <SelectItem value="percentage">Percentage Discount</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                    <SelectItem value="first_order">First Order Only</SelectItem>
                    <SelectItem value="birthday">Birthday Reward</SelectItem>
                    <SelectItem value="referral">Referral Code</SelectItem>
                    <SelectItem value="category_specific">Category Restricted</SelectItem>
                    <SelectItem value="product_specific">Product Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="value" className="text-gray-700 font-semibold">
                  Discount Value ({type === 'percentage' ? '%' : '₹'}) *
                </Label>
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="E.g., 10 or 150"
                  value={value || ''}
                  onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                  disabled={type === 'free_shipping'}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                  required={type !== 'free_shipping'}
                />
              </div>
            </div>

            {/* Threshold limits: Min Order & Max Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="minOrder" className="text-gray-700 font-semibold">Minimum Order Amount (₹)</Label>
                <Input
                  id="minOrder"
                  type="number"
                  min="0"
                  placeholder="No minimum"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxDiscount" className="text-gray-700 font-semibold">Maximum Discount Cap (₹)</Label>
                <Input
                  id="maxDiscount"
                  type="number"
                  min="0"
                  placeholder="Unlimited discount"
                  value={maxDiscountAmount}
                  disabled={type !== 'percentage'}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
            </div>

            {/* Restriction Fields: category/product */}
            {type === 'category_specific' && (
              <div className="space-y-1.5">
                <Label htmlFor="categoryId" className="text-gray-700 font-semibold">Restricted Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="categoryId" className="rounded-xl border-gray-200 h-10 focus:ring-[#1a3b2b]">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-150">
                    <SelectItem value="none">Choose category...</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === 'product_specific' && (
              <div className="space-y-1.5">
                <Label htmlFor="foodItemId" className="text-gray-700 font-semibold">Restricted Product</Label>
                <Select value={foodItemId} onValueChange={setFoodItemId}>
                  <SelectTrigger id="foodItemId" className="rounded-xl border-gray-200 h-10 focus:ring-[#1a3b2b]">
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-150">
                    <SelectItem value="none">Choose product...</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campaign Validity Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-gray-700 font-semibold">Campaign Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-gray-700 font-semibold">Campaign End Date</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
            </div>

            {/* Limits: Usage count limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="usageLimit" className="text-gray-700 font-semibold">Global Usage Limit</Label>
                <Input
                  id="usageLimit"
                  type="number"
                  min="1"
                  placeholder="Unlimited usage"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="userLimit" className="text-gray-700 font-semibold">Max Uses Per Customer</Label>
                <Input
                  id="userLimit"
                  type="number"
                  min="1"
                  value={maxUsesPerUser}
                  onChange={(e) => setMaxUsesPerUser(parseInt(e.target.value) || 1)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
            </div>

            {/* Active Status toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-700">Enable Campaign</span>
                <p className="text-[10px] text-gray-400">If toggled off, checkout validation rejects code automatically</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="rounded-xl border-gray-250 hover:bg-gray-50 text-gray-600 px-5 h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#1a3b2b] hover:bg-[#122b1f] text-white rounded-xl shadow-md px-6 h-10"
              >
                Save Campaign
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* PERFORMANCE DRAWER */}
      <Sheet open={isPerfOpen} onOpenChange={setIsPerfOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto rounded-l-2xl border-l border-gray-150 p-6 bg-white">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[#d4af37]" /> Coupon Performance: {selectedCoupon?.code}
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              Realtime campaign ledger recording LTV contribution, redemptions, and order value impacts.
            </SheetDescription>
          </SheetHeader>

          {perfLoading ? (
            <div className="py-20 text-center text-gray-400">Fetching performance metrics...</div>
          ) : (
            <div className="space-y-6 text-xs">
              {/* Key Metrics cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="bg-white border border-gray-100 shadow-sm rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Usage Count</span>
                  <h4 className="text-lg font-bold text-gray-800 mt-1">{perfData.usageCount}</h4>
                </Card>
                <Card className="bg-white border border-gray-100 shadow-sm rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Remaining Uses</span>
                  <h4 className="text-lg font-bold text-gray-800 mt-1">
                    {selectedCoupon?.usage_limit 
                      ? Math.max(0, selectedCoupon.usage_limit - perfData.usageCount)
                      : 'Unlimited'}
                  </h4>
                </Card>
                <Card className="bg-white border border-gray-100 shadow-sm rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Revenue Generated</span>
                  <h4 className="text-lg font-bold text-emerald-600 mt-1">₹{perfData.totalRevenue.toLocaleString()}</h4>
                </Card>
                <Card className="bg-white border border-gray-100 shadow-sm rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Discount Given</span>
                  <h4 className="text-lg font-bold text-[#5c2018] mt-1">₹{perfData.totalDiscount.toLocaleString()}</h4>
                </Card>
              </div>

              {/* AOV Comparison Card */}
              <Card className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Average Order Value (AOV)</span>
                    <p className="text-[10px] text-gray-400">Average billing total of checkouts using code</p>
                  </div>
                </div>
                <span className="text-base font-bold text-gray-800">₹{perfData.aov.toFixed(2)}</span>
              </Card>

              {/* Redemptions Table Ledger */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold font-serif text-gray-800">Redemption History</h3>
                <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="font-semibold text-gray-600 text-[10px] py-3 pl-4">Order ID</TableHead>
                        <TableHead className="font-semibold text-gray-600 text-[10px] py-3">Customer</TableHead>
                        <TableHead className="font-semibold text-gray-600 text-[10px] py-3">Date</TableHead>
                        <TableHead className="font-semibold text-gray-600 text-[10px] py-3">Discount</TableHead>
                        <TableHead className="font-semibold text-gray-600 text-[10px] py-3 pr-4 text-right">Order Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perfData.redemptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-gray-400 text-xs">
                            No redemptions logged yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        perfData.redemptions.map(r => (
                          <TableRow key={r.id} className="hover:bg-gray-50/30">
                            <TableCell className="font-mono text-[10px] text-[#1a3b2b] py-3 pl-4">
                              #{r.order_id.substring(0, 8)}
                            </TableCell>
                            <TableCell className="text-gray-700 py-3">
                              {r.orders?.profiles?.full_name || 'Anonymous User'}
                            </TableCell>
                            <TableCell className="text-gray-500 py-3">
                              {new Date(r.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-bold text-[#5c2018] py-3">
                              -₹{r.discount_amount}
                            </TableCell>
                            <TableCell className="font-bold text-gray-800 py-3 pr-4 text-right">
                              ₹{r.orders?.total_amount || 0}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
