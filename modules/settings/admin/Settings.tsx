import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Store, Search, CreditCard, Truck, Mail, MessageSquare, 
  Percent, Share2, Cpu, Save, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { useUnsavedChangesGuard } from '@/components/system/UnsavedChangesGuard';


type CategoryType = 'store' | 'seo' | 'payment' | 'shipping' | 'email' | 'sms' | 'tax' | 'social' | 'system';

interface CategoryConfig {
  id: CategoryType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'store', name: 'Store Profile', description: 'Address, contact email, phone, and standard store currency settings', icon: Store },
  { id: 'seo', name: 'SEO & Metadata', description: 'Homepage tags, search descriptions, keywords, and sitemaps', icon: Search },
  { id: 'payment', name: 'Payment Integrations', description: 'Enable cash on delivery or input online gateway Razorpay credentials', icon: CreditCard },
  { id: 'shipping', name: 'Shipping & Delivery', description: 'Configure standard courier rates and thresholds for free shipping benefits', icon: Truck },
  { id: 'email', name: 'Email Settings (SMTP)', description: 'Set SMTP servers, port keys, authentication parameters and senders', icon: Mail },
  { id: 'sms', name: 'SMS Gateways', description: 'Sender ID, Gateway tokens, and order update SMS templates', icon: MessageSquare },
  { id: 'tax', name: 'Tax Rates & Registration', description: 'GST percentages, inclusion parameters, and corporate numbers', icon: Percent },
  { id: 'social', name: 'Social Handles', description: 'Connect buyer-facing channels like Instagram, Facebook and YouTube links', icon: Share2 },
  { id: 'system', name: 'System Settings', description: 'Maintenance toggles, log definitions, and default pagination thresholds', icon: Cpu }
];

const DEFAULT_SETTINGS = {
  store: {
    storeName: 'Aayish Foods',
    contactEmail: 'sales@aayishfoods.com',
    contactPhone: '+91 98765 43210',
    currency: 'INR',
    address: '123 Gourmet Lane, Food City, Tamil Nadu, 600001'
  },
  seo: {
    metaTitle: 'Aayish Foods - Authentic Traditional Recipes Online',
    metaDescription: 'Order traditional pickles, spices, and homemade treats prepared with love and organic ingredients.',
    metaKeywords: 'pickles, organic spices, authentic treats, traditional foods, gourmet indian food',
    sitemapUrl: 'https://www.aayishfoods.online/sitemap.xml'
  },
  payment: {
    enableCOD: true,
    enableRazorpay: true,
    razorpayKeyId: 'rzp_live_AayishKey123',
    razorpayKeySecret: '••••••••••••••••••••••••'
  },
  shipping: {
    deliveryFee: 60,
    freeShippingThreshold: 500,
    deliveryBufferDays: 3
  },
  email: {
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    smtpUser: 'apikey',
    smtpFromEmail: 'noreply@aayishfoods.online'
  },
  sms: {
    smsGatewayKey: 'tw_key_982347293847923',
    smsSenderId: 'AYISHF',
    smsTemplateOrderConfirmed: 'Dear Customer, your order #{{order_id}} of {{amount}} is confirmed. Track it at {{tracking_url}}'
  },
  tax: {
    taxPercentage: 5,
    taxInclusivePricing: true,
    taxRegistrationNumber: '33AAAAA1111A1Z1'
  },
  social: {
    facebookLink: 'https://facebook.com/aayishfoods',
    instagramLink: 'https://instagram.com/aayishfoods',
    twitterLink: 'https://twitter.com/aayishfoods',
    youtubeLink: 'https://youtube.com/c/aayishfoods'
  },
  system: {
    maintenanceMode: false,
    itemsPerPage: 12,
    logLevel: 'info'
  }
};

interface SettingsState {
  store: {
    storeName: string;
    contactEmail: string;
    contactPhone: string;
    currency: string;
    address: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    sitemapUrl: string;
  };
  payment: {
    enableCOD: boolean;
    enableRazorpay: boolean;
    razorpayKeyId: string;
    razorpayKeySecret: string;
  };
  shipping: {
    deliveryFee: number;
    freeShippingThreshold: number;
    deliveryBufferDays: number;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpFromEmail: string;
  };
  sms: {
    smsGatewayKey: string;
    smsSenderId: string;
    smsTemplateOrderConfirmed: string;
  };
  tax: {
    taxPercentage: number;
    taxInclusivePricing: boolean;
    taxRegistrationNumber: string;
  };
  social: {
    facebookLink: string;
    instagramLink: string;
    twitterLink: string;
    youtubeLink: string;
  };
  system: {
    maintenanceMode: boolean;
    itemsPerPage: number;
    logLevel: string;
  };
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryType>('store');
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [dbRows, setDbRows] = useState<{ key: string; category: string; value: Record<string, string | number | boolean> }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (!loading && !isInitialLoad) {
      setIsDirty(true);
    }
  }, [settings]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        setDbRows(data as unknown as { key: string; category: string; value: Record<string, string | number | boolean> }[]);
        const compiled = { ...DEFAULT_SETTINGS } as any;
        data.forEach(row => {
          const category = row.category as CategoryType;
          if (row.value && category in DEFAULT_SETTINGS) {
            compiled[category] = {
              ...compiled[category],
              ...(row.value as any)
            };
          }
        });
        setSettings(compiled);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load settings: ' + errMsg);
    } finally {
      setLoading(false);
      setTimeout(() => setIsInitialLoad(false), 200);
    }
  };

  const handleFieldChange = (category: CategoryType, field: string, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleSaveCategory = async () => {
    if (!user) {
      toast.error('Authentication session is missing.');
      return;
    }
    setSaving(true);
    try {
      const categoryKey = activeCategory;
      const nextValue = settings[activeCategory];
      const existingRow = dbRows.find(r => r.key === categoryKey);
      const oldVal = existingRow ? existingRow.value : null;

      // 1. Save / Upsert Settings
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({
          key: categoryKey,
          category: activeCategory,
          value: nextValue,
          updated_at: new Date().toISOString()
        });

      if (settingsError) throw settingsError;

      // 2. Automate change auditing writing old/new json data snapshots to audit_logs
      await auditService.log(
        oldVal ? 'update' : 'create',
        'settings',
        categoryKey,
        oldVal as Record<string, unknown> | null,
        nextValue as Record<string, unknown>
      );

      window.formIsDirty = false;
      setIsDirty(false);
      toast.success(`${CATEGORIES.find(c => c.id === activeCategory)?.name} saved and audited successfully.`);
      fetchSettings(); // Refresh from DB
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to save settings category: ' + errMsg);
    } finally {
      setSaving(false);
    }
  };

  const currentSettings = (settings[activeCategory] || {}) as any;

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-xs font-semibold">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Store Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure global store details, security profiles, payment APIs, tax configurations, and system parameters</p>
        </div>
        <Button 
          onClick={fetchSettings} 
          variant="outline" 
          disabled={loading}
          className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload Configurations
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar categories selector */}
        <div className="space-y-1.5 lg:col-span-1">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center space-x-3 w-full text-left p-3.5 rounded-2xl transition-all border ${
                  isActive 
                    ? 'bg-[#1a3b2b] text-[#d4af37] border-[#d4af37]/20 shadow-md shadow-[#1a3b2b]/10' 
                    : 'bg-white hover:bg-gray-50/50 text-gray-700 border-gray-100 hover:border-gray-200'
                }`}
              >
                <cat.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[#d4af37]' : 'text-gray-400'}`} />
                <div>
                  <span className="font-bold text-xs block">{cat.name}</span>
                  <span className={`text-[10px] line-clamp-1 mt-0.5 ${isActive ? 'text-[#fdfbf7]/80 font-normal' : 'text-gray-400 font-medium'}`}>
                    {cat.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Configurations Forms Container */}
        <div className="lg:col-span-3">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-50 p-6 bg-gray-50/20">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                {(() => {
                  const Icon = CATEGORIES.find(c => c.id === activeCategory)?.icon || Store;
                  return <Icon className="h-5 w-5 text-[#1a3b2b]" />;
                })()}
                {CATEGORIES.find(c => c.id === activeCategory)?.name} Settings
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-1">
                {CATEGORIES.find(c => c.id === activeCategory)?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {loading ? (
                <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#1a3b2b]" />
                  <p className="text-xs font-semibold">Retrieving secure values...</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Category forms switch */}
                  {activeCategory === 'store' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="storeName">Store Name</Label>
                        <Input
                          id="storeName"
                          value={currentSettings.storeName || ''}
                          onChange={(e) => handleFieldChange('store', 'storeName', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contactEmail">Customer Support Email</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          value={currentSettings.contactEmail || ''}
                          onChange={(e) => handleFieldChange('store', 'contactEmail', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contactPhone">Store Support Phone</Label>
                        <Input
                          id="contactPhone"
                          value={currentSettings.contactPhone || ''}
                          onChange={(e) => handleFieldChange('store', 'contactPhone', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="currency">Currency Code</Label>
                        <Select 
                          value={currentSettings.currency || 'INR'} 
                          onValueChange={(val) => handleFieldChange('store', 'currency', val)}
                        >
                          <SelectTrigger id="currency" className="border-gray-200 rounded-xl focus:ring-[#1a3b2b] h-10 font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-150">
                            <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                            <SelectItem value="USD">USD ($) - United States Dollar</SelectItem>
                            <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                            <SelectItem value="GBP">GBP (£) - British Pound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="address">Physical Warehouse HQ Address</Label>
                        <Textarea
                          id="address"
                          value={currentSettings.address || ''}
                          onChange={(e) => handleFieldChange('store', 'address', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] min-h-[80px] font-medium text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeCategory === 'seo' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="metaTitle">Default Browser Meta Title</Label>
                        <Input
                          id="metaTitle"
                          value={currentSettings.metaTitle || ''}
                          onChange={(e) => handleFieldChange('seo', 'metaTitle', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="metaDescription">Default Meta Description</Label>
                        <Textarea
                          id="metaDescription"
                          value={currentSettings.metaDescription || ''}
                          onChange={(e) => handleFieldChange('seo', 'metaDescription', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] min-h-[70px] font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="metaKeywords">Site-Wide SEO Keywords (Comma Separated)</Label>
                        <Input
                          id="metaKeywords"
                          value={currentSettings.metaKeywords || ''}
                          onChange={(e) => handleFieldChange('seo', 'metaKeywords', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sitemapUrl">Sitemap XML URL</Label>
                        <Input
                          id="sitemapUrl"
                          value={currentSettings.sitemapUrl || ''}
                          onChange={(e) => handleFieldChange('seo', 'sitemapUrl', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeCategory === 'payment' && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="space-y-0.5 pr-4">
                          <Label className="text-gray-950 font-bold block">Enable Cash on Delivery (COD)</Label>
                          <span className="text-[10px] text-gray-400 font-medium block">Allow buyers to checkout orders with payments on delivery</span>
                        </div>
                        <Switch
                          checked={currentSettings.enableCOD ?? true}
                          onCheckedChange={(checked) => handleFieldChange('payment', 'enableCOD', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="space-y-0.5 pr-4">
                          <Label className="text-gray-950 font-bold block">Enable Razorpay Integration</Label>
                          <span className="text-[10px] text-gray-400 font-medium block">Accept digital payments via UPI, NetBanking and credit cards</span>
                        </div>
                        <Switch
                          checked={currentSettings.enableRazorpay ?? true}
                          onCheckedChange={(checked) => handleFieldChange('payment', 'enableRazorpay', checked)}
                        />
                      </div>

                      {currentSettings.enableRazorpay && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-fade-in">
                          <div className="space-y-1.5">
                            <Label htmlFor="razorpayKeyId">Razorpay API Key ID</Label>
                            <Input
                              id="razorpayKeyId"
                              value={currentSettings.razorpayKeyId || ''}
                              onChange={(e) => handleFieldChange('payment', 'razorpayKeyId', e.target.value)}
                              className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-mono text-xs font-semibold text-gray-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="razorpayKeySecret">Razorpay Key Secret Token</Label>
                            <Input
                              id="razorpayKeySecret"
                              type="password"
                              value={currentSettings.razorpayKeySecret || ''}
                              onChange={(e) => handleFieldChange('payment', 'razorpayKeySecret', e.target.value)}
                              className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-mono text-xs font-semibold text-gray-800"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeCategory === 'shipping' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="deliveryFee">Standard Delivery Fee (₹)</Label>
                        <Input
                          id="deliveryFee"
                          type="number"
                          value={currentSettings.deliveryFee ?? 0}
                          onChange={(e) => handleFieldChange('shipping', 'deliveryFee', Number(e.target.value))}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="freeShippingThreshold">Free Shipping Threshold (₹)</Label>
                        <Input
                          id="freeShippingThreshold"
                          type="number"
                          value={currentSettings.freeShippingThreshold ?? 0}
                          onChange={(e) => handleFieldChange('shipping', 'freeShippingThreshold', Number(e.target.value))}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="deliveryBufferDays">Standard Logistics SLA Buffer (Days)</Label>
                        <Input
                          id="deliveryBufferDays"
                          type="number"
                          value={currentSettings.deliveryBufferDays ?? 0}
                          onChange={(e) => handleFieldChange('shipping', 'deliveryBufferDays', Number(e.target.value))}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeCategory === 'email' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="smtpHost">SMTP Server Host</Label>
                        <Input
                          id="smtpHost"
                          value={currentSettings.smtpHost || ''}
                          onChange={(e) => handleFieldChange('email', 'smtpHost', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpPort">SMTP Service Port</Label>
                        <Input
                          id="smtpPort"
                          type="number"
                          value={currentSettings.smtpPort ?? 587}
                          onChange={(e) => handleFieldChange('email', 'smtpPort', Number(e.target.value))}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="smtpUser">SMTP Authentication Username</Label>
                        <Input
                          id="smtpUser"
                          value={currentSettings.smtpUser || ''}
                          onChange={(e) => handleFieldChange('email', 'smtpUser', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpFromEmail">Sender Identity From Email</Label>
                        <Input
                          id="smtpFromEmail"
                          type="email"
                          value={currentSettings.smtpFromEmail || ''}
                          onChange={(e) => handleFieldChange('email', 'smtpFromEmail', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeCategory === 'sms' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="smsGatewayKey">SMS Gateway API Key</Label>
                          <Input
                            id="smsGatewayKey"
                            type="password"
                            value={currentSettings.smsGatewayKey || ''}
                            onChange={(e) => handleFieldChange('sms', 'smsGatewayKey', e.target.value)}
                            className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-mono text-xs font-semibold text-gray-800"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="smsSenderId">SMS Custom Sender ID (6 Characters)</Label>
                          <Input
                            id="smsSenderId"
                            maxLength={6}
                            value={currentSettings.smsSenderId || ''}
                            onChange={(e) => handleFieldChange('sms', 'smsSenderId', e.target.value.toUpperCase())}
                            className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-bold tracking-wider text-gray-900 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smsTemplate">Transactional SMS Body Template (Order Confirmed)</Label>
                        <Textarea
                          id="smsTemplate"
                          value={currentSettings.smsTemplateOrderConfirmed || ''}
                          onChange={(e) => handleFieldChange('sms', 'smsTemplateOrderConfirmed', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] min-h-[90px] font-medium text-gray-900 text-xs"
                        />
                        <span className="text-[10px] text-gray-400 font-medium mt-1 block">Variables supported: `{"{{order_id}}"}` , `{"{{amount}}"}` , `{"{{tracking_url}}"}`</span>
                      </div>
                    </div>
                  )}

                  {activeCategory === 'tax' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="taxPercentage">GST Rate Percentage (%)</Label>
                          <Input
                            id="taxPercentage"
                            type="number"
                            step="0.01"
                            value={currentSettings.taxPercentage ?? 5}
                            onChange={(e) => handleFieldChange('tax', 'taxPercentage', Number(e.target.value))}
                            className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="taxRegistrationNumber">GSTRIN / Corporate Registration No.</Label>
                          <Input
                            id="taxRegistrationNumber"
                            value={currentSettings.taxRegistrationNumber || ''}
                            onChange={(e) => handleFieldChange('tax', 'taxRegistrationNumber', e.target.value.toUpperCase())}
                            className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-bold text-gray-900"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl mt-2">
                        <div className="space-y-0.5 pr-4">
                          <Label className="text-gray-950 font-bold block">Tax-Inclusive Product Pricing</Label>
                          <span className="text-[10px] text-gray-400 font-medium block">Product listing prices automatically include tax ratios</span>
                        </div>
                        <Switch
                          checked={currentSettings.taxInclusivePricing ?? true}
                          onCheckedChange={(checked) => handleFieldChange('tax', 'taxInclusivePricing', checked)}
                        />
                      </div>
                    </div>
                  )}

                  {activeCategory === 'social' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="facebookLink">Facebook Page URL</Label>
                        <Input
                          id="facebookLink"
                          value={currentSettings.facebookLink || ''}
                          onChange={(e) => handleFieldChange('social', 'facebookLink', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="instagramLink">Instagram Page URL</Label>
                        <Input
                          id="instagramLink"
                          value={currentSettings.instagramLink || ''}
                          onChange={(e) => handleFieldChange('social', 'instagramLink', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="twitterLink">Twitter Profile URL</Label>
                        <Input
                          id="twitterLink"
                          value={currentSettings.twitterLink || ''}
                          onChange={(e) => handleFieldChange('social', 'twitterLink', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="youtubeLink">YouTube Channel URL</Label>
                        <Input
                          id="youtubeLink"
                          value={currentSettings.youtubeLink || ''}
                          onChange={(e) => handleFieldChange('social', 'youtubeLink', e.target.value)}
                          className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                        />
                      </div>
                    </div>
                  )}

                  {activeCategory === 'system' && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="space-y-0.5 pr-4">
                          <Label className="text-gray-950 font-bold block">Maintenance Mode</Label>
                          <span className="text-[10px] text-gray-400 font-medium block">Block public buyer access with a beautiful maintenance screen</span>
                        </div>
                        <Switch
                          checked={currentSettings.maintenanceMode ?? false}
                          onCheckedChange={(checked) => handleFieldChange('system', 'maintenanceMode', checked)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="itemsPerPage">Default Items Per Page</Label>
                          <Input
                            id="itemsPerPage"
                            type="number"
                            value={currentSettings.itemsPerPage ?? 12}
                            onChange={(e) => handleFieldChange('system', 'itemsPerPage', Number(e.target.value))}
                            className="border-gray-200 rounded-xl focus-visible:ring-[#1a3b2b] h-10 font-medium text-gray-900"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="logLevel">System Log Level Threshold</Label>
                          <Select 
                            value={currentSettings.logLevel || 'info'} 
                            onValueChange={(val) => handleFieldChange('system', 'logLevel', val)}
                          >
                            <SelectTrigger id="logLevel" className="border-gray-200 rounded-xl focus:ring-[#1a3b2b] h-10 font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-gray-150">
                              <SelectItem value="debug">DEBUG (Verbose Trace)</SelectItem>
                              <SelectItem value="info">INFO (Standard Activity)</SelectItem>
                              <SelectItem value="warn">WARN (Non-blocking Errors)</SelectItem>
                              <SelectItem value="error">ERROR (System Failures Only)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-6 border-t border-gray-50 flex justify-end">
                    <Button 
                      onClick={handleSaveCategory}
                      disabled={saving}
                      className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl shadow-md px-6 h-10 flex items-center gap-1.5"
                    >
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Configurations
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
