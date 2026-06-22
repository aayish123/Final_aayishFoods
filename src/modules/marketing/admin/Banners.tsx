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
import MediaLibraryDrawer from '@/components/admin/MediaLibraryDrawer';
import { 
  Sliders, Plus, Search, Edit, Trash2, Calendar, Layout, RefreshCw,
  Smartphone, Monitor, Eye, MousePointerClick, Percent, 
  TrendingUp, TrendingDown, Image as ImageIcon 
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/common/ConfirmDialog';


interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  page: string;
  section: string;
  device_type: 'desktop' | 'mobile' | 'all';
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface BannerAnalyticsMap {
  [bannerId: string]: {
    views: number;
    clicks: number;
    ctr: number;
  };
}

export default function AdminBanners() {
  const { confirm } = useConfirm();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [analytics, setAnalytics] = useState<BannerAnalyticsMap>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  
  // Media picker drawer
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [page, setPage] = useState('home');
  const [section, setSection] = useState('hero');
  const [deviceType, setDeviceType] = useState<Banner['device_type']>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchBannersAndAnalytics();
  }, []);

  const fetchBannersAndAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch Banners
      const { data: bannersData, error: bannersErr } = await supabase
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true });

      if (bannersErr) throw bannersErr;
      const fetchedBanners = (bannersData as Banner[]) || [];
      setBanners(fetchedBanners);

      // 2. Fetch Live Analytics
      const { data: analyticsData, error: analyticsErr } = await supabase
        .from('banner_analytics')
        .select('banner_id, event_type');

      if (analyticsErr) throw analyticsErr;

      // Group analytics by banner_id
      const analyticsMap: BannerAnalyticsMap = {};
      
      // Initialize map for all fetched banners
      fetchedBanners.forEach(b => {
        analyticsMap[b.id] = { views: 0, clicks: 0, ctr: 0 };
      });

      // Accumulate counts
      if (analyticsData) {
        analyticsData.forEach(row => {
          const bannerId = row.banner_id;
          const type = row.event_type;

          if (!analyticsMap[bannerId]) {
            analyticsMap[bannerId] = { views: 0, clicks: 0, ctr: 0 };
          }

          if (type === 'view') {
            analyticsMap[bannerId].views += 1;
          } else if (type === 'click') {
            analyticsMap[bannerId].clicks += 1;
          }
        });
      }

      // Compute CTR for each
      Object.keys(analyticsMap).forEach(bannerId => {
        const { views, clicks } = analyticsMap[bannerId];
        analyticsMap[bannerId].ctr = views > 0 ? (clicks / views) * 100 : 0;
      });

      setAnalytics(analyticsMap);
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Failed to load banners and metrics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const computeStatus = (banner: Banner): 'active' | 'scheduled' | 'expired' | 'disabled' => {
    if (!banner.is_active) return 'disabled';
    const now = new Date();
    if (banner.start_date && new Date(banner.start_date) > now) {
      return 'scheduled';
    }
    if (banner.end_date && new Date(banner.end_date) < now) {
      return 'expired';
    }
    return 'active';
  };

  const handleOpenForm = (banner: Banner | null = null) => {
    if (banner) {
      setEditingBanner(banner);
      setTitle(banner.title);
      setImageUrl(banner.image_url);
      setLinkUrl(banner.link_url || '');
      setPage(banner.page);
      setSection(banner.section);
      setDeviceType(banner.device_type);
      setStartDate(banner.start_date ? banner.start_date.substring(0, 16) : '');
      setEndDate(banner.end_date ? banner.end_date.substring(0, 16) : '');
      setDisplayOrder(banner.display_order);
      setIsActive(banner.is_active);
    } else {
      setEditingBanner(null);
      setTitle('');
      setImageUrl('');
      setLinkUrl('');
      setPage('home');
      setSection('hero');
      setDeviceType('all');
      setStartDate('');
      setEndDate('');
      setDisplayOrder(0);
      setIsActive(true);
    }
    setIsFormOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      toast.error('Please fill in a title and select a banner image.');
      return;
    }

    const payload = {
      title: title.trim(),
      image_url: imageUrl.trim(),
      link_url: linkUrl.trim() || null,
      page: page.trim().toLowerCase(),
      section: section.trim().toLowerCase(),
      device_type: deviceType,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      display_order: displayOrder,
      is_active: isActive,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingBanner) {
        const { error } = await supabase
          .from('banners')
          .update(payload)
          .eq('id', editingBanner.id);
        if (error) throw error;
        toast.success('Banner updated successfully!');
      } else {
        const { error } = await supabase
          .from('banners')
          .insert([payload]);
        if (error) throw error;
        toast.success('Banner created successfully!');
      }
      setIsFormOpen(false);
      fetchBannersAndAnalytics();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Failed to save banner: ' + error.message);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    confirm({
      title: 'Delete Banner Configuration',
      message: 'Are you sure you want to permanently delete this banner configuration? It will immediately stop rendering on target storefront pages.',
      confirmText: 'Delete Banner',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('banners').delete().eq('id', id);
          if (error) throw error;
          toast.success('Banner deleted successfully.');
          fetchBannersAndAnalytics();
        } catch (err) {
          console.error(err);
          const error = err as Error;
          toast.error('Failed to delete banner: ' + error.message);
        }
      }
    });
  };

  const handleMediaSelect = (url: string) => {
    setImageUrl(url);
    toast.success('Banner asset selected from library!');
  };

  // Filter banners
  const filteredBanners = banners.filter(b => {
    const status = computeStatus(b);
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.page.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.section.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDevice = deviceFilter === 'all' || b.device_type === deviceFilter;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesDevice && matchesStatus;
  });

  // Analytics totals
  let totalImpressions = 0;
  let totalClicks = 0;
  
  Object.values(analytics).forEach(a => {
    totalImpressions += a.views;
    totalClicks += a.clicks;
  });

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Best & Worst performing calculations (requires at least 1 view to count)
  let topPerformingBanner: Banner | null = null;
  let worstPerformingBanner: Banner | null = null;
  let topCtr = -1;
  let worstCtr = 999;

  banners.forEach(b => {
    const stats = analytics[b.id];
    if (stats && stats.views > 0) {
      if (stats.ctr > topCtr) {
        topCtr = stats.ctr;
        topPerformingBanner = b;
      }
      if (stats.ctr < worstCtr) {
        worstCtr = stats.ctr;
        worstPerformingBanner = b;
      }
    }
  });

  // If no banner has views, or they are equal
  if (topCtr === -1) topPerformingBanner = null;
  if (worstCtr === 999) worstPerformingBanner = null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50">Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-50">Scheduled</Badge>;
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Expired</Badge>;
      case 'disabled':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200/50 hover:bg-rose-50">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Banners Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Schedule display ads, sliders, popup promotions, and track realtime conversion ratios</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            onClick={() => fetchBannersAndAnalytics()} 
            variant="outline" 
            className="border-gray-250 bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded-xl h-11"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Ads
          </Button>
          <Button 
            onClick={() => handleOpenForm(null)}
            className="bg-[#1a3b2b] hover:bg-[#122b1f] text-white rounded-xl shadow-md flex items-center gap-2 h-11"
          >
            <Plus className="h-4 w-4" /> Create Ad Banner
          </Button>
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Banners</span>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{banners.length}</h3>
            </div>
            <div className="bg-[#5c2018]/5 p-3 rounded-xl text-[#5c2018]">
              <Sliders className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ad Impressions</span>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">{totalImpressions.toLocaleString()}</h3>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
              <Eye className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Clicks Logged</span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{totalClicks.toLocaleString()}</h3>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
              <MousePointerClick className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Average Ad CTR</span>
              <h3 className="text-2xl font-bold text-[#d4af37] mt-1">{avgCtr.toFixed(2)}%</h3>
            </div>
            <div className="bg-[#d4af37]/5 p-3 rounded-xl text-[#d4af37]">
              <Percent className="h-6 w-6 stroke-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top and Worst Performing banner split alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topPerformingBanner ? (
          <Card className="bg-emerald-50/40 border border-emerald-100 shadow-sm rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 text-white p-2 rounded-xl">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-emerald-800 block">Top CTR Banner ({analytics[(topPerformingBanner as Banner).id]?.ctr.toFixed(1)}%)</span>
                <span className="text-gray-500 font-medium font-serif mt-0.5 block">{(topPerformingBanner as Banner).title}</span>
              </div>
            </div>
            <div className="w-16 h-10 rounded overflow-hidden border border-emerald-200">
              <img src={(topPerformingBanner as Banner).image_url} alt="Top Performing" className="w-full h-full object-cover" />
            </div>
          </Card>
        ) : (
          <Card className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 flex items-center justify-center text-center text-xs text-gray-400">
            No impressions logged to resolve Top CTR Banner.
          </Card>
        )}

        {worstPerformingBanner ? (
          <Card className="bg-rose-50/40 border border-rose-100 shadow-sm rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-rose-500 text-white p-2 rounded-xl">
                <TrendingDown className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-rose-800 block">Lowest CTR Banner ({analytics[(worstPerformingBanner as Banner).id]?.ctr.toFixed(1)}%)</span>
                <span className="text-gray-500 font-medium font-serif mt-0.5 block">{(worstPerformingBanner as Banner).title}</span>
              </div>
            </div>
            <div className="w-16 h-10 rounded overflow-hidden border border-rose-250">
              <img src={(worstPerformingBanner as Banner).image_url} alt="Worst Performing" className="w-full h-full object-cover" />
            </div>
          </Card>
        ) : (
          <Card className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 flex items-center justify-center text-center text-xs text-gray-400">
            No impressions logged to resolve Lowest CTR Banner.
          </Card>
        )}
      </div>

      {/* Index table */}
      <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <CardTitle className="text-lg font-serif font-bold text-gray-800">Banner Index</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search titles, pages or zones..."
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
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>

              {/* Device filter */}
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-36 bg-gray-50/50 border-gray-200 rounded-xl text-xs h-9 focus:ring-1 focus:ring-[#1a3b2b]">
                  <SelectValue placeholder="Device Target" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-150">
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="all_banners">Unified ('all')</SelectItem>
                  <SelectItem value="desktop">Desktop Only</SelectItem>
                  <SelectItem value="mobile">Mobile Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-gray-400">Loading banner configurations...</div>
          ) : filteredBanners.length === 0 ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center">
              <Sliders className="h-12 w-12 text-gray-200 mb-2 stroke-1" />
              <p className="font-medium text-sm">No banners found</p>
              <p className="text-xs text-gray-400 mt-0.5">Create a banner or adjust your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-600 text-xs px-6 py-4">Preview & Title</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Page / Zone</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Placement</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Device</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4 text-center">Weight</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">CTR Analytics</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Validity Range</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs py-4">Status</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-xs text-right px-6 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBanners.map(banner => {
                    const status = computeStatus(banner);
                    const stats = analytics[banner.id] || { views: 0, clicks: 0, ctr: 0 };
                    return (
                      <TableRow key={banner.id} className="hover:bg-gray-50/40 transition-colors">
                        <TableCell className="px-6 py-4 font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-10 rounded overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                              <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-gray-800 font-serif leading-tight">{banner.title}</span>
                              {banner.link_url && (
                                <span className="text-[10px] text-[#1a3b2b] truncate max-w-[150px]">{banner.link_url}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 capitalize">
                          {banner.page}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 capitalize">
                          {banner.section}
                        </TableCell>
                        <TableCell className="text-xs">
                          {banner.device_type === 'desktop' ? (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Monitor className="h-3.5 w-3.5" /> <span>Desktop</span>
                            </div>
                          ) : banner.device_type === 'mobile' ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <Smartphone className="h-3.5 w-3.5" /> <span>Mobile</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Layout className="h-3.5 w-3.5" /> <span>Unified</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center font-bold text-gray-800">
                          {banner.display_order}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-gray-700">{stats.views} views</span>
                            <span className="text-[10px] text-gray-400">
                              {stats.clicks} clicks • <b className="text-gray-600">{stats.ctr.toFixed(1)}% CTR</b>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          <div className="flex flex-col">
                            {banner.start_date ? (
                              <span>Starts: {new Date(banner.start_date).toLocaleDateString()}</span>
                            ) : (
                              <span>Instant</span>
                            )}
                            {banner.end_date ? (
                              <span>Ends: {new Date(banner.end_date).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-gray-400">Continuous</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {getStatusBadge(status)}
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleOpenForm(banner)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-[#1a3b2b] hover:bg-[#1a3b2b]/5 rounded-lg"
                              title="Edit Banner"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteBanner(banner.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Banner"
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
              {editingBanner ? 'Edit Ad Banner' : 'Create Ad Banner'}
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              Define marketing dimensions, placement rules, active calendar periods, and target screens.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveBanner} className="space-y-5 text-xs">
            {/* Banner Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-gray-700 font-semibold">Banner Ad Title *</Label>
              <Input
                id="title"
                placeholder="E.g., Monsoon Spices Clearance Sale"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                required
              />
            </div>

            {/* Target URL */}
            <div className="space-y-1.5">
              <Label htmlFor="linkUrl" className="text-gray-700 font-semibold">Destination Redirect Link (URL)</Label>
              <Input
                id="linkUrl"
                placeholder="E.g., /category/pickles or absolute web link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
              />
            </div>

            {/* Image Selector */}
            <div className="space-y-1.5">
              <Label className="text-gray-700 font-semibold block">Banner Image Asset *</Label>
              <div className="flex gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Select asset or enter direct image URL..."
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b] flex-1 font-mono text-[11px]"
                  required
                />
                <Button
                  type="button"
                  onClick={() => setIsMediaPickerOpen(true)}
                  className="bg-[#1a3b2b]/5 hover:bg-[#1a3b2b]/10 text-[#1a3b2b] border border-[#1a3b2b]/10 rounded-xl h-10 px-4 flex items-center gap-1.5 font-bold"
                >
                  <ImageIcon className="h-4 w-4" /> Browse
                </Button>
              </div>
              
              {imageUrl && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100 mt-2 max-w-sm">
                  <img src={imageUrl} alt="Active Selection" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Placement Fields: Page & Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="page" className="text-gray-700 font-semibold">Active Page Target</Label>
                <Select value={page} onValueChange={setPage}>
                  <SelectTrigger id="page" className="rounded-xl border-gray-200 h-10 focus:ring-[#1a3b2b]">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-150">
                    <SelectItem value="home">Home / Entrance</SelectItem>
                    <SelectItem value="menu">Menu / Category Grid</SelectItem>
                    <SelectItem value="checkout">Checkout Panel</SelectItem>
                    <SelectItem value="offers">Promotions Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="section" className="text-gray-700 font-semibold">Section / Slot Placement</Label>
                <Select value={section} onValueChange={setSection}>
                  <SelectTrigger id="section" className="rounded-xl border-gray-200 h-10 focus:ring-[#1a3b2b]">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-150">
                    <SelectItem value="hero">Hero Top Slider</SelectItem>
                    <SelectItem value="middle">Middle Promo Ribbon</SelectItem>
                    <SelectItem value="sidebar">Sidebar Slot</SelectItem>
                    <SelectItem value="popup">Entrance Modal Popup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Device Target & Order Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="deviceType" className="text-gray-700 font-semibold">Device Audience Filter</Label>
                <Select value={deviceType} onValueChange={(val: Banner['device_type']) => setDeviceType(val)}>
                  <SelectTrigger id="deviceType" className="rounded-xl border-gray-200 h-10 focus:ring-[#1a3b2b]">
                    <SelectValue placeholder="All devices" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-150">
                    <SelectItem value="all">Unified Display (All Screen Widths)</SelectItem>
                    <SelectItem value="desktop">Desktop Browser Screens Only</SelectItem>
                    <SelectItem value="mobile">Mobile / Tablet Viewports Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="displayOrder" className="text-gray-700 font-semibold">Display Sequence Order Weight</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  placeholder="E.g., 0, 1, 2"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
            </div>

            {/* Active Schedule Validity Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-gray-700 font-semibold">Schedule Start Time</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-gray-700 font-semibold">Schedule End Time</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 focus-visible:ring-[#1a3b2b]"
                />
              </div>
            </div>

            {/* Active Switch status toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-700">Ad Active Status</span>
                <p className="text-[10px] text-gray-400">If checked off, banner will be hidden regardless of validity calendar</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {/* Form actions */}
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
                Save Configuration
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* MEDIA PICKER INTEGRATION */}
      <MediaLibraryDrawer
        open={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        defaultFolder="banners"
      />
    </div>
  );
}
