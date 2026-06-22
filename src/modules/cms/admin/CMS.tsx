import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Edit, Eye, History, Save, RefreshCw, Send, CheckCircle, RotateCcw, 
  Trash2, Plus, Monitor, Smartphone, Star, Award, Leaf, Heart, Shield, Truck, Sparkles
} from 'lucide-react';
import MediaLibraryDrawer from '@/components/admin/MediaLibraryDrawer';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { useUnsavedChangesGuard } from '@/components/system/UnsavedChangesGuard';
import { useConfirm } from '@/components/common/ConfirmDialog';


type SectionType = 'hero' | 'about' | 'testimonials' | 'faq' | 'trust_badges' | 'footer';

interface SectionConfig {
  id: SectionType;
  name: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'hero', name: 'Hero Header Banner', description: 'Headline banner text, CTA buttons, and high-resolution menu background image' },
  { id: 'about', name: 'About Legacy Block', description: 'Corporate history text, side illustrations, and list check feature points' },
  { id: 'testimonials', name: 'Buyer Testimonials', description: 'Community review grids, rating stars, names, and location roles' },
  { id: 'faq', name: 'FAQ Accordion', description: 'Answer buyer queries about shipping, organic preserves, and payment details' },
  { id: 'trust_badges', name: 'Trust Core Badges', description: 'Highlight trust elements (FSSAI registered, rural self-help groups, local spices)' },
  { id: 'footer', name: 'Footer Settings', description: 'Copyright details, company taglines, warehouse address, and social links' }
];

const DEFAULT_CMS_CONTENT = {
  hero: {
    title: 'Authentic Traditional Indian Recipes',
    subtitle: 'Homemade organic pickles, hand-ground spices, and traditional treats prepared with love and heritage methods.',
    ctaText: 'Explore Menu',
    ctaLink: '/menu',
    bgImageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=1200'
  },
  about: {
    title: 'A Legacy of Pure Flavors',
    description: 'At Aayish Foods, we preserve the rich heritage of traditional South Indian recipes. Our ingredients are sourced directly from organic farmers, sun-dried, and ground by hand using stone grinders to maintain original nutritional values and authentic taste.',
    imageUrl: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=600',
    features: [
      '100% Homemade & Handcrafted',
      'Directly Sourced Organic Spices',
      'Preserved by Sun-Drying Methods'
    ]
  },
  testimonials: {
    title: 'Love from Our Community',
    list: [
      { id: '1', author: 'Anjali Sharma', role: 'Chennai', comment: "The mango pickle took me straight back to my grandmother's kitchen! The spice blend is perfectly balanced and not oily.", rating: 5 },
      { id: '2', author: 'Ravi Kumar', role: 'Bangalore', comment: "I've been ordering the hand-ground sambar powder for six months. It has a beautiful aroma that store-bought options just don't have.", rating: 5 }
    ]
  },
  faq: {
    title: 'Frequently Asked Questions',
    list: [
      { id: '1', question: 'Are your products free of artificial preservatives?', answer: 'Yes, all our food items are prepared without any artificial chemicals or synthetic preservatives. We use traditional oils and natural salt concentrations for long shelf life.' },
      { id: '2', question: 'Do you deliver pan-India?', answer: 'Yes, we ship to all major cities and towns across India. Shipping details and timelines can be viewed at checkout.' }
    ]
  },
  trust_badges: {
    title: 'Why Choose Aayish?',
    list: [
      { id: '1', icon: 'Award', title: 'Traditional Recipes', description: 'Authentic recipes handed down through generations' },
      { id: '2', icon: 'Leaf', title: '100% Organic', description: 'Sourced from organic farming partners' },
      { id: '3', icon: 'Heart', title: 'Handcrafted', description: 'Prepared by rural women self-help cooperatives' }
    ]
  },
  footer: {
    copyright: '© 2026 Aayish Foods. All Rights Reserved.',
    tagline: 'Pure, authentic, and organic traditional delicacies delivered to your home.',
    contactEmail: 'sales@aayishfoods.com',
    contactPhone: '+91 98765 43210',
    contactAddress: '123 Gourmet Lane, Food City, Tamil Nadu, 600001',
    facebookUrl: 'https://facebook.com/aayishfoods',
    instagramUrl: 'https://instagram.com/aayishfoods'
  }
};

interface CMSListItem {
  id: string;
  author?: string;
  role?: string;
  comment?: string;
  rating?: number;
  question?: string;
  answer?: string;
  icon?: string;
  title?: string;
  description?: string;
}

interface GenericCMSContent {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  bgImageUrl?: string;
  description?: string;
  imageUrl?: string;
  features?: string[];
  list?: CMSListItem[];
  copyright?: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}

interface DBSection {
  id: string;
  version: number;
  published_version: number;
  draft_content: GenericCMSContent;
  published_content: GenericCMSContent;
  updated_at: string;
}

interface PublishHistoryRecord {
  id: string;
  section_id: string;
  version: number;
  published_content: GenericCMSContent;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
}

export default function AdminCMS() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionType>('hero');
  const [activeTab, setActiveTab] = useState('edit'); // 'edit', 'preview', 'history'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dbSections, setDbSections] = useState<DBSection[]>([]);
  const [historyRecords, setHistoryRecords] = useState<PublishHistoryRecord[]>([]);

  // Unsaved Changes Guard
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { confirm } = useConfirm();

  useUnsavedChangesGuard(isDirty);

  // Draft editing states
  const [draftContent, setDraftContent] = useState<GenericCMSContent>({});

  // Set isInitialLoad to true when changing activeSection or loading initial data
  useEffect(() => {
    setIsInitialLoad(true);
    setIsDirty(false);
  }, [activeSection]);

  // Set isInitialLoad to false when loading completes
  useEffect(() => {
    if (draftContent && Object.keys(draftContent).length > 0) {
      const timer = setTimeout(() => setIsInitialLoad(false), 200);
      return () => clearTimeout(timer);
    }
  }, [draftContent]);

  // Watch draftContent changes
  useEffect(() => {
    if (!loading && !saving && !publishing && !isInitialLoad) {
      setIsDirty(true);
    }
  }, [draftContent]);
  
  // Media drawer config
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<string | null>(null);

  // Preview options
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    fetchCMSData();
  }, []);

  useEffect(() => {
    const currentDb = dbSections.find(s => s.id === activeSection);
    if (currentDb) {
      setDraftContent(currentDb.draft_content || DEFAULT_CMS_CONTENT[activeSection]);
    } else {
      setDraftContent(DEFAULT_CMS_CONTENT[activeSection]);
    }

    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeSection, dbSections, activeTab]);

  const fetchCMSData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cms_sections')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        setDbSections(data as DBSection[]);
      } else {
        // Dynamic seeding if cms_sections is empty
        await seedDefaultCMS();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load CMS content: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultCMS = async () => {
    try {
      const payload = Object.keys(DEFAULT_CMS_CONTENT).map(key => ({
        id: key,
        version: 1,
        published_version: 1,
        draft_content: (DEFAULT_CMS_CONTENT as Record<string, GenericCMSContent>)[key],
        published_content: (DEFAULT_CMS_CONTENT as Record<string, GenericCMSContent>)[key],
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('cms_sections')
        .insert(payload as any);

      if (error) throw error;
      fetchCMSData();
    } catch (err) {
      console.error('Failed seeding CMS content:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('cms_publish_history')
        .select('*, profiles:published_by(full_name)')
        .eq('section_id', activeSection)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistoryRecords((data as unknown as PublishHistoryRecord[]) || []);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const handleUpdateDraftField = <K extends keyof GenericCMSContent>(
    field: K,
    value: GenericCMSContent[K]
  ) => {
    setDraftContent((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const currentDb = dbSections.find(s => s.id === activeSection);
      const nextVersion = (currentDb?.version || 1) + 1;

      const { error } = await supabase
        .from('cms_sections')
        .update({
          draft_content: draftContent as any,
          version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSection);

      if (error) throw error;

      window.formIsDirty = false;
      setIsDirty(false);
      toast.success('Section draft saved successfully.');
      fetchCMSData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save draft: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishSection = async () => {
    if (!user) return;
    setPublishing(true);
    try {
      const currentDb = dbSections.find(s => s.id === activeSection);
      const versionToPublish = currentDb?.version || 1;
      const prevPublished = currentDb?.published_content;

      // 1. Update main record in cms_sections
      const { error: cmsErr } = await supabase
        .from('cms_sections')
        .update({
          published_content: draftContent as any,
          published_version: versionToPublish,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSection);

      if (cmsErr) throw cmsErr;

      // 2. Insert record into cms_publish_history
      const { error: historyErr } = await (supabase as any)
        .from('cms_publish_history')
        .insert({
          section_id: activeSection,
          version: versionToPublish,
          published_by: user.id,
          published_content: draftContent as any
        });

      if (historyErr) throw historyErr;

      // 3. Write record into audit_logs table
      await auditService.log(
        'publish',
        'cms',
        activeSection,
        prevPublished as unknown as Record<string, unknown> | null,
        draftContent as unknown as Record<string, unknown> | null
      );

      window.formIsDirty = false;
      setIsDirty(false);
      toast.success(`Section ${activeSection.toUpperCase()} successfully published to live website.`);
      fetchCMSData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to publish section: ' + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (record: PublishHistoryRecord) => {
    if (!user) return;
    
    confirm({
      title: 'Rollback CMS Content',
      message: `Are you sure you want to rollback the draft content to Version ${record.version}?`,
      confirmText: 'Yes, Rollback',
      cancelText: 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        setLoading(true);
        try {
          const currentDb = dbSections.find(s => s.id === activeSection);
          const nextVersion = (currentDb?.version || 1) + 1;

          // Update draft state to historical version
          const { error } = await supabase
            .from('cms_sections')
            .update({
              draft_content: record.published_content as any,
              version: nextVersion,
              updated_at: new Date().toISOString()
            })
            .eq('id', activeSection);

          if (error) throw error;

          window.formIsDirty = false;
          setIsDirty(false);
          toast.success(`Draft successfully rolled back to Version ${record.version}. Click publish to make it live.`);
          fetchCMSData();
        } catch (err) {
          console.error(err);
          toast.error('Rollback failed: ' + (err as Error).message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const openMediaPicker = (field: string) => {
    setMediaTargetField(field);
    setMediaOpen(true);
  };

  const handleMediaSelect = (url: string) => {
    if (mediaTargetField) {
      handleUpdateDraftField(mediaTargetField as keyof GenericCMSContent, url);
      setMediaTargetField(null);
    }
  };

  const currentDbState = dbSections.find(s => s.id === activeSection);
  const draftVersionNum = currentDbState?.version || 1;
  const liveVersionNum = currentDbState?.published_version || 0;

  // Icon mapper helper
  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Award': return Award;
      case 'Leaf': return Leaf;
      case 'Heart': return Heart;
      case 'Shield': return Shield;
      case 'Truck': return Truck;
      default: return Sparkles;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-xs font-semibold">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Homepage CMS Builder</h1>
          <p className="text-gray-500 text-sm mt-1">Configure draft layouts, view live rendering simulations, publish segments, and access rollback lists</p>
        </div>
        <Button 
          onClick={fetchCMSData} 
          variant="outline" 
          disabled={loading}
          className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Editor
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sections Selector Sidebar */}
        <div className="space-y-1.5 lg:col-span-1">
          {SECTIONS.map(sec => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center space-x-3 w-full text-left p-3.5 rounded-2xl transition-all border ${
                  isActive 
                    ? 'bg-[#1a3b2b] text-[#d4af37] border-[#d4af37]/20 shadow-md shadow-[#1a3b2b]/10' 
                    : 'bg-white hover:bg-gray-50/50 text-gray-700 border-gray-100'
                }`}
              >
                <Edit className={`h-5 w-5 shrink-0 ${isActive ? 'text-[#d4af37]' : 'text-gray-400'}`} />
                <div>
                  <span className="font-bold text-xs block">{sec.name}</span>
                  <span className={`text-[10px] line-clamp-1 mt-0.5 ${isActive ? 'text-[#fdfbf7]/80 font-normal' : 'text-gray-400 font-medium'}`}>
                    {sec.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Form and Preview Tabs Container */}
        <div className="lg:col-span-3">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <Tabs defaultValue="edit" value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
              <div className="flex justify-between items-center bg-gray-50/30 px-6 py-3 border-b border-gray-100">
                <TabsList className="bg-[#1a3b2b]/5 border border-[#1a3b2b]/10 p-0.5 rounded-xl w-fit">
                  <TabsTrigger value="edit" className="rounded-lg px-4 py-2 text-xs data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
                    <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Draft
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="rounded-lg px-4 py-2 text-xs data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Live Preview
                  </TabsTrigger>
                  <TabsTrigger value="history" className="rounded-lg px-4 py-2 text-xs data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">
                    <History className="h-3.5 w-3.5 mr-1.5" /> Publishing & Version history
                  </TabsTrigger>
                </TabsList>

                {/* Status indicator values */}
                <div className="flex gap-2">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px]">Draft V{draftVersionNum}</span>
                  {liveVersionNum > 0 ? (
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px]">Live V{liveVersionNum}</span>
                  ) : (
                    <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px]">Not Live</span>
                  )}
                </div>
              </div>

              {/* TABS BODY */}
              {/* TAB 1: FORM INPUTS */}
              <TabsContent value="edit" className="p-6 focus-visible:outline-none space-y-5">
                {loading ? (
                  <div className="py-24 text-center text-gray-400">Loading editors...</div>
                ) : (
                  <div className="space-y-4">
                    {activeSection === 'hero' && (
                      <div className="space-y-4 text-xs font-semibold">
                        <div className="space-y-1.5">
                          <Label htmlFor="hero-title">Main Hero Headline Title</Label>
                          <Input
                            id="hero-title"
                            value={draftContent.title || ''}
                            onChange={(e) => handleUpdateDraftField('title', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="hero-subtitle">Sub-headline Description</Label>
                          <Textarea
                            id="hero-subtitle"
                            value={draftContent.subtitle || ''}
                            onChange={(e) => handleUpdateDraftField('subtitle', e.target.value)}
                            className="border-gray-200 rounded-xl min-h-[70px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="hero-cta-text">CTA Button Text</Label>
                            <Input
                              id="hero-cta-text"
                              value={draftContent.ctaText || ''}
                              onChange={(e) => handleUpdateDraftField('ctaText', e.target.value)}
                              className="border-gray-200 rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="hero-cta-link">CTA Button Link</Label>
                            <Input
                              id="hero-cta-link"
                              value={draftContent.ctaLink || ''}
                              onChange={(e) => handleUpdateDraftField('ctaLink', e.target.value)}
                              className="border-gray-200 rounded-xl"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="hero-bg">Hero Background Image URL</Label>
                          <div className="flex gap-2">
                            <Input
                              id="hero-bg"
                              value={draftContent.bgImageUrl || ''}
                              onChange={(e) => handleUpdateDraftField('bgImageUrl', e.target.value)}
                              className="border-gray-200 rounded-xl flex-1 font-mono text-[10px]"
                            />
                            <Button
                              type="button"
                              onClick={() => openMediaPicker('bgImageUrl')}
                              variant="outline"
                              className="border-gray-200 hover:bg-gray-50 shrink-0 rounded-xl h-9"
                            >
                              Library Media
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSection === 'about' && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="about-title">Block Title</Label>
                          <Input
                            id="about-title"
                            value={draftContent.title || ''}
                            onChange={(e) => handleUpdateDraftField('title', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="about-desc">Corporate History Narrative</Label>
                          <Textarea
                            id="about-desc"
                            value={draftContent.description || ''}
                            onChange={(e) => handleUpdateDraftField('description', e.target.value)}
                            className="border-gray-200 rounded-xl min-h-[90px]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="about-img">Illustration Image URL</Label>
                          <div className="flex gap-2">
                            <Input
                              id="about-img"
                              value={draftContent.imageUrl || ''}
                              onChange={(e) => handleUpdateDraftField('imageUrl', e.target.value)}
                              className="border-gray-200 rounded-xl flex-1 font-mono text-[10px]"
                            />
                            <Button
                              type="button"
                              onClick={() => openMediaPicker('imageUrl')}
                              variant="outline"
                              className="border-gray-200 hover:bg-gray-50 rounded-xl h-9"
                            >
                              Library Media
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Feature Checkpoints List (Bullet Items)</Label>
                          {draftContent.features?.map((feat: string, idx: number) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={feat}
                                onChange={(e) => {
                                  const updated = [...(draftContent.features || [])];
                                  updated[idx] = e.target.value;
                                  handleUpdateDraftField('features', updated);
                                }}
                                className="border-gray-200 rounded-xl"
                                placeholder={`Feature ${idx + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSection === 'testimonials' && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="test-title">Section Headline Title</Label>
                          <Input
                            id="test-title"
                            value={draftContent.title || ''}
                            onChange={(e) => handleUpdateDraftField('title', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>

                        <div className="space-y-3.5 pt-2">
                          <Label>Community Testimonials Ledger</Label>
                          {draftContent.list?.map((item, idx) => (
                            <div key={item.id || idx} className="bg-gray-50 border border-gray-150 p-4 rounded-2xl relative space-y-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const listCopy = [...(draftContent.list || [])];
                                  listCopy.splice(idx, 1);
                                  handleUpdateDraftField('list', listCopy);
                                }}
                                className="absolute top-3.5 right-3.5 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove testimonial"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>

                              <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Author Name</Label>
                                  <Input
                                    value={item.author || ''}
                                    onChange={(e) => {
                                      const listCopy = [...(draftContent.list || [])];
                                      listCopy[idx] = { ...listCopy[idx], author: e.target.value };
                                      handleUpdateDraftField('list', listCopy);
                                    }}
                                    className="border-gray-200 bg-white rounded-xl h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Role / City</Label>
                                  <Input
                                    value={item.role || ''}
                                    onChange={(e) => {
                                      const listCopy = [...(draftContent.list || [])];
                                      listCopy[idx] = { ...listCopy[idx], role: e.target.value };
                                      handleUpdateDraftField('list', listCopy);
                                    }}
                                    className="border-gray-200 bg-white rounded-xl h-8 text-xs"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 items-end">
                                <div className="space-y-1 col-span-2">
                                  <Label className="text-[10px]">Review Comment</Label>
                                  <Textarea
                                    value={item.comment || ''}
                                    onChange={(e) => {
                                      const listCopy = [...(draftContent.list || [])];
                                      listCopy[idx] = { ...listCopy[idx], comment: e.target.value };
                                      handleUpdateDraftField('list', listCopy);
                                    }}
                                    className="border-gray-200 bg-white rounded-xl min-h-[50px] text-xs"
                                  />
                                </div>
                                <div className="space-y-1 col-span-1">
                                  <Label className="text-[10px]">Rating Score</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={item.rating || 5}
                                    onChange={(e) => {
                                      const listCopy = [...(draftContent.list || [])];
                                      listCopy[idx] = { ...listCopy[idx], rating: Number(e.target.value) };
                                      handleUpdateDraftField('list', listCopy);
                                    }}
                                    className="border-gray-200 bg-white rounded-xl h-8 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          <Button
                            type="button"
                            onClick={() => {
                              const listCopy = [...(draftContent.list || [])];
                              listCopy.push({ id: Date.now().toString(), author: 'New Reviewer', role: 'Delhi', comment: 'Review comment details.', rating: 5 });
                              handleUpdateDraftField('list', listCopy);
                            }}
                            variant="outline"
                            className="w-full border-dashed border-gray-300 hover:bg-gray-50 h-10 rounded-xl flex items-center justify-center gap-1 text-[#1a3b2b] font-bold"
                          >
                            <Plus className="h-4 w-4" /> Add Testimonial Card
                          </Button>
                        </div>
                      </div>
                    )}

                    {activeSection === 'faq' && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="faq-title">Section Main Title</Label>
                          <Input
                            id="faq-title"
                            value={draftContent.title || ''}
                            onChange={(e) => handleUpdateDraftField('title', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>

                        <div className="space-y-3.5 pt-2">
                          <Label>FAQ Accordion Rows</Label>
                          {draftContent.list?.map((item, idx) => (
                            <div key={item.id || idx} className="bg-gray-50 border border-gray-150 p-4 rounded-2xl relative space-y-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const listCopy = [...(draftContent.list || [])];
                                  listCopy.splice(idx, 1);
                                  handleUpdateDraftField('list', listCopy);
                                }}
                                className="absolute top-3.5 right-3.5 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove FAQ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>

                              <div className="space-y-1">
                                <Label className="text-[10px]">Question Headline</Label>
                                <Input
                                  value={item.question || ''}
                                  onChange={(e) => {
                                    const listCopy = [...(draftContent.list || [])];
                                    listCopy[idx] = { ...listCopy[idx], question: e.target.value };
                                    handleUpdateDraftField('list', listCopy);
                                  }}
                                  className="border-gray-200 bg-white rounded-xl h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">Answer Explanation</Label>
                                <Textarea
                                  value={item.answer || ''}
                                  onChange={(e) => {
                                    const listCopy = [...(draftContent.list || [])];
                                    listCopy[idx] = { ...listCopy[idx], answer: e.target.value };
                                    handleUpdateDraftField('list', listCopy);
                                  }}
                                  className="border-gray-200 bg-white rounded-xl min-h-[50px] text-xs"
                                />
                              </div>
                            </div>
                          ))}

                          <Button
                            type="button"
                            onClick={() => {
                              const listCopy = [...(draftContent.list || [])];
                              listCopy.push({ id: Date.now().toString(), question: 'Sample Question?', answer: 'Answer content.' });
                              handleUpdateDraftField('list', listCopy);
                            }}
                            variant="outline"
                            className="w-full border-dashed border-gray-300 hover:bg-gray-50 h-10 rounded-xl flex items-center justify-center gap-1 text-[#1a3b2b] font-bold"
                          >
                            <Plus className="h-4 w-4" /> Add FAQ Row
                          </Button>
                        </div>
                      </div>
                    )}

                    {activeSection === 'trust_badges' && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="tb-title">Section Heading Title</Label>
                          <Input
                            id="tb-title"
                            value={draftContent.title || ''}
                            onChange={(e) => handleUpdateDraftField('title', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>

                        <div className="space-y-4 pt-2">
                          <Label>Trust Elements (3 Badges)</Label>
                          {draftContent.list?.map((item, idx) => (
                            <div key={item.id || idx} className="bg-gray-50 border border-gray-150 p-4 rounded-2xl grid grid-cols-3 gap-3.5">
                              <div className="col-span-1 space-y-1.5">
                                <Label className="text-[10px]">Badge Icon</Label>
                                <Select
                                  value={item.icon || 'Award'}
                                  onValueChange={(val) => {
                                    const listCopy = [...(draftContent.list || [])];
                                    listCopy[idx] = { ...listCopy[idx], icon: val };
                                    handleUpdateDraftField('list', listCopy);
                                  }}
                                >
                                  <SelectTrigger className="border-gray-200 bg-white rounded-xl h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-gray-150 text-xs">
                                    <SelectItem value="Award">Award Badge</SelectItem>
                                    <SelectItem value="Leaf">Organic Leaf</SelectItem>
                                    <SelectItem value="Heart">Heart Handmade</SelectItem>
                                    <SelectItem value="Shield">Secure Shield</SelectItem>
                                    <SelectItem value="Truck">Logistics Truck</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2 space-y-1.5">
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Badge Headline</Label>
                                  <Input
                                    value={item.title || ''}
                                    onChange={(e) => {
                                      const listCopy = [...(draftContent.list || [])];
                                      listCopy[idx] = { ...listCopy[idx], title: e.target.value };
                                      handleUpdateDraftField('list', listCopy);
                                    }}
                                    className="border-gray-200 bg-white rounded-xl h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px]">Sub-description</Label>
                                  <Input
                                    value={item.description || ''}
                                    onChange={(e) => {
                                      const listCopy = [...(draftContent.list || [])];
                                      listCopy[idx] = { ...listCopy[idx], description: e.target.value };
                                      handleUpdateDraftField('list', listCopy);
                                    }}
                                    className="border-gray-200 bg-white rounded-xl h-8 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSection === 'footer' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="foot-copyright">Copyright Notice</Label>
                          <Input
                            id="foot-copyright"
                            value={draftContent.copyright || ''}
                            onChange={(e) => handleUpdateDraftField('copyright', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="foot-tagline">Footer Brand Tagline</Label>
                          <Textarea
                            id="foot-tagline"
                            value={draftContent.tagline || ''}
                            onChange={(e) => handleUpdateDraftField('tagline', e.target.value)}
                            className="border-gray-200 rounded-xl min-h-[60px]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="foot-email">Contact Email</Label>
                          <Input
                            id="foot-email"
                            type="email"
                            value={draftContent.contactEmail || ''}
                            onChange={(e) => handleUpdateDraftField('contactEmail', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="foot-phone">Contact Phone</Label>
                          <Input
                            id="foot-phone"
                            value={draftContent.contactPhone || ''}
                            onChange={(e) => handleUpdateDraftField('contactPhone', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="foot-address">Contact Physical Address</Label>
                          <Input
                            id="foot-address"
                            value={draftContent.contactAddress || ''}
                            onChange={(e) => handleUpdateDraftField('contactAddress', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="foot-fb">Facebook URL Link</Label>
                          <Input
                            id="foot-fb"
                            value={draftContent.facebookUrl || ''}
                            onChange={(e) => handleUpdateDraftField('facebookUrl', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="foot-insta">Instagram URL Link</Label>
                          <Input
                            id="foot-insta"
                            value={draftContent.instagramUrl || ''}
                            onChange={(e) => handleUpdateDraftField('instagramUrl', e.target.value)}
                            className="border-gray-200 rounded-xl"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Save bar */}
                <div className="pt-6 border-t border-gray-50 flex justify-end gap-2">
                  <Button
                    onClick={handleSaveDraft}
                    disabled={saving || loading}
                    className="border border-[#1a3b2b]/20 hover:bg-[#1a3b2b]/5 bg-white text-[#1a3b2b] rounded-xl font-bold px-5 h-10"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Save Section Draft
                  </Button>
                  <Button
                    onClick={handlePublishSection}
                    disabled={publishing || loading}
                    className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] rounded-xl font-bold px-6 h-10 shadow-md flex items-center gap-1.5"
                  >
                    {publishing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish to Website
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 2: LIVE PREVIEW */}
              <TabsContent value="preview" className="p-6 focus-visible:outline-none space-y-4">
                <div className="flex justify-between items-center bg-gray-50 border border-gray-150 p-2.5 rounded-xl text-xs font-bold text-gray-500">
                  <span>Draft Live Render Simulation</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => setPreviewViewport('desktop')}
                      variant={previewViewport === 'desktop' ? 'default' : 'outline'}
                      className={`h-7 px-3 rounded-lg ${previewViewport === 'desktop' ? 'bg-[#1a3b2b] text-[#d4af37]' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      <Monitor className="h-3.5 w-3.5 mr-1" /> Desktop
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setPreviewViewport('mobile')}
                      variant={previewViewport === 'mobile' ? 'default' : 'outline'}
                      className={`h-7 px-3 rounded-lg ${previewViewport === 'mobile' ? 'bg-[#1a3b2b] text-[#d4af37]' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      <Smartphone className="h-3.5 w-3.5 mr-1" /> Mobile
                    </Button>
                  </div>
                </div>

                {/* Preview frame simulator */}
                <div className="border border-gray-200 rounded-2xl bg-gray-100 p-6 flex justify-center overflow-x-auto min-h-[450px]">
                  <div 
                    className={`bg-white shadow-xl transition-all duration-300 overflow-y-auto ${
                      previewViewport === 'mobile' ? 'w-[375px] h-[667px] border-8 border-gray-800 rounded-3xl' : 'w-full min-h-[400px]'
                    }`}
                  >
                    {/* Visual heritage mock blocks */}
                    {activeSection === 'hero' && (
                      <div 
                        className="relative bg-cover bg-center flex items-center min-h-[380px] p-8 text-white flex-col justify-center text-center bg-slate-900"
                        style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url(${draftContent.bgImageUrl || '/placeholder.svg'})` }}
                      >
                        <h2 className="font-serif text-[#d4af37] text-3xl font-extrabold tracking-wide max-w-lg leading-tight">
                          {draftContent.title || 'Headline'}
                        </h2>
                        <p className="text-gray-200 mt-4 max-w-md text-xs font-normal leading-relaxed">
                          {draftContent.subtitle || 'Description details.'}
                        </p>
                        <Button className="bg-[#d4af37] hover:bg-[#bfa032] text-gray-900 font-bold px-6 h-10 mt-6 rounded-xl shadow-lg border-0 uppercase tracking-wider text-[10px]">
                          {draftContent.ctaText || 'Button'}
                        </Button>
                      </div>
                    )}

                    {activeSection === 'about' && (
                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#fdfbf7]">
                        <div className="space-y-4">
                          <h3 className="font-serif text-[#5c2018] text-2xl font-bold">{draftContent.title}</h3>
                          <p className="text-gray-600 text-xs font-medium leading-relaxed">{draftContent.description}</p>
                          <div className="space-y-2 pt-2">
                            {draftContent.features?.map((f: string, i: number) => (
                              <div key={i} className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-[#1a3b2b] shrink-0" />
                                <span className="text-gray-800 font-bold text-xs">{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border-2 border-[#d4af37]/20">
                          <img src={draftContent.imageUrl} alt="About Us" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}

                    {activeSection === 'testimonials' && (
                      <div className="p-8 bg-[#fdfbf7] space-y-6">
                        <div className="text-center">
                          <h3 className="font-serif text-[#5c2018] text-2xl font-bold">{draftContent.title}</h3>
                          <span className="h-0.5 w-16 bg-[#d4af37] block mx-auto mt-2" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {draftContent.list?.map((item) => (
                            <div key={item.id} className="bg-white border border-[#1a3b2b]/5 p-5 rounded-2xl shadow-sm space-y-3">
                              <div className="flex gap-0.5">
                                {Array.from({ length: item.rating }).map((_, i) => (
                                  <Star key={i} className="h-4 w-4 fill-amber-400 stroke-amber-400" />
                                ))}
                              </div>
                              <p className="text-gray-600 text-[11px] leading-relaxed italic">"{item.comment}"</p>
                              <div>
                                <span className="font-bold text-gray-900 text-xs block">{item.author}</span>
                                <span className="text-gray-400 text-[10px] uppercase font-bold mt-0.5 block">{item.role}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSection === 'faq' && (
                      <div className="p-8 bg-[#fdfbf7] space-y-6">
                        <div className="text-center">
                          <h3 className="font-serif text-[#5c2018] text-2xl font-bold">{draftContent.title}</h3>
                          <span className="h-0.5 w-16 bg-[#d4af37] block mx-auto mt-2" />
                        </div>
                        <div className="space-y-3.5 max-w-xl mx-auto">
                          {draftContent.list?.map((item) => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                              <span className="font-bold text-gray-950 text-xs block">{item.question}</span>
                              <span className="text-gray-500 text-[11px] font-medium leading-relaxed mt-2 block border-t border-gray-50 pt-2">{item.answer}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSection === 'trust_badges' && (
                      <div className="p-8 bg-white space-y-6">
                        <div className="text-center">
                          <h3 className="font-serif text-[#5c2018] text-2xl font-bold">{draftContent.title}</h3>
                          <span className="h-0.5 w-16 bg-[#d4af37] block mx-auto mt-2" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {draftContent.list?.map((item) => {
                            const Icon = getBadgeIcon(item.icon || '');
                            return (
                              <div key={item.id} className="text-center flex flex-col items-center space-y-2.5 p-4 rounded-xl border border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <div className="h-12 w-12 rounded-full bg-[#1a3b2b]/10 flex items-center justify-center text-[#1a3b2b] shadow-sm">
                                  <Icon className="h-6 w-6" />
                                </div>
                                <h4 className="font-bold text-gray-900 text-xs">{item.title}</h4>
                                <p className="text-gray-500 text-[10px] leading-normal font-medium">{item.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeSection === 'footer' && (
                      <footer className="bg-[#2c130f] text-white p-8 space-y-6 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b border-white/10">
                          <div className="space-y-2">
                            <span className="text-sm font-serif font-bold text-[#d4af37] uppercase tracking-wider block">Aayish Foods</span>
                            <p className="text-gray-300 text-[10px] leading-relaxed font-normal">{draftContent.tagline}</p>
                          </div>
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider block">Contact us</span>
                            <p className="text-gray-300 text-[10px] leading-normal font-normal">
                              Email: {draftContent.contactEmail}<br />
                              Phone: {draftContent.contactPhone}<br />
                              Address: {draftContent.contactAddress}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider block">Follow us</span>
                            <div className="flex gap-2">
                              <span className="text-gray-300 hover:text-white cursor-pointer underline text-[10px]">Facebook</span>
                              <span className="text-gray-300 hover:text-white cursor-pointer underline text-[10px]">Instagram</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-center text-[10px] text-white/50">
                          {draftContent.copyright}
                        </div>
                      </footer>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: PUBLISHING & VERSION HISTORY */}
              <TabsContent value="history" className="p-6 focus-visible:outline-none space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 border border-gray-150 p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Current Draft State</span>
                    <span className="text-gray-900 font-extrabold text-base block mt-1">Version {draftVersionNum}</span>
                    <span className="text-[10px] text-gray-500 font-medium block mt-1">Modified at: {currentDbState?.updated_at ? new Date(currentDbState.updated_at).toLocaleString() : '—'}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-150 p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Active Published State</span>
                    <span className="text-emerald-700 font-extrabold text-base block mt-1">
                      {liveVersionNum > 0 ? `Version ${liveVersionNum}` : 'Not Live'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium block mt-1">Requires publisher credentials to alter live CDN</span>
                  </div>
                  <div className="flex items-center">
                    <Button
                      onClick={handlePublishSection}
                      disabled={publishing || loading}
                      className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl w-full h-12 shadow-lg flex items-center justify-center gap-1.5"
                    >
                      {publishing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
                      Publish Draft V{draftVersionNum} Live
                    </Button>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Historical Version Records (Postgres Publish Ledger)</h3>
                  {historyRecords.length === 0 ? (
                    <div className="py-12 border border-dashed border-gray-200 rounded-xl text-center text-gray-400">
                      No publication history records loaded for this section.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-sm">
                      {historyRecords.map(record => {
                        const isCurrentlyLive = record.version === liveVersionNum;
                        return (
                          <div key={record.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors font-medium">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 text-xs">Version {record.version}</span>
                                {isCurrentlyLive && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">Active Live</span>}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Published by: <b>{record.profiles?.full_name || 'System Auto'}</b> on {new Date(record.created_at).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <Button
                              onClick={() => handleRollback(record)}
                              variant="outline"
                              size="sm"
                              className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-8 text-[11px] flex items-center gap-1"
                            >
                              <RotateCcw className="h-3 w-3" /> Rollback here
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Reusable Image picker modal drawer */}
      <MediaLibraryDrawer
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={handleMediaSelect}
        defaultFolder="cms"
      />
    </div>
  );
}
