import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { heroService, HeroSettings as HeroSettingsType } from '@/shared/services/heroService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Image as ImageIcon, Laptop, Smartphone, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import MediaLibraryDrawer from '@/components/admin/MediaLibraryDrawer';

// Static default fallback values
const STATIC_HERO: HeroSettingsType = {
  title: 'The Authentic Taste of Andhra & Telangana',
  subtitle: 'Traditional Recipes. Premium Ingredients. Made with Love.',
  description: 'Handcrafted pickles, traditional sweets, and crispy snacks prepared using age-old family recipes and fresh ingredients.',
  primary_button_text: 'Shop Now',
  primary_button_url: '/menu',
  secondary_button_text: 'Explore Collection',
  secondary_button_url: '/menu',
  hero_image: '',
  background_image: '',
  badge_text: '100% Homemade'
};

export default function HeroSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  
  // Media Drawer states
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTargetField, setMediaTargetField] = useState<'hero_image' | 'background_image' | null>(null);

  // Form states
  const [draft, setDraft] = useState<HeroSettingsType>({ ...STATIC_HERO });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Query database settings
  const { data: heroData, isLoading, isError } = useQuery({
    queryKey: ['hero-settings'],
    queryFn: heroService.getHeroSettings,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Set draft from database if loaded
  useEffect(() => {
    if (heroData) {
      setDraft({
        title: heroData.title || STATIC_HERO.title,
        subtitle: heroData.subtitle || STATIC_HERO.subtitle,
        description: heroData.description ?? STATIC_HERO.description,
        primary_button_text: heroData.primary_button_text ?? STATIC_HERO.primary_button_text,
        primary_button_url: heroData.primary_button_url ?? STATIC_HERO.primary_button_url,
        secondary_button_text: heroData.secondary_button_text ?? STATIC_HERO.secondary_button_text,
        secondary_button_url: heroData.secondary_button_url ?? STATIC_HERO.secondary_button_url,
        hero_image: heroData.hero_image ?? STATIC_HERO.hero_image,
        background_image: heroData.background_image ?? STATIC_HERO.background_image,
        badge_text: heroData.badge_text ?? STATIC_HERO.badge_text
      });
    }
  }, [heroData]);

  // Mutation to update settings
  const saveMutation = useMutation({
    mutationFn: heroService.updateHeroSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-settings'] });
      toast.success('Hero settings updated successfully!');
    },
    onError: (err: any) => {
      console.error('Failed to update hero settings:', err);
      toast.error(err.message || 'Failed to update hero settings. Check permissions.');
    }
  });

  // Handle text input changes & validate character limits
  const handleInputChange = (field: keyof HeroSettingsType, value: string, maxLen?: number) => {
    if (maxLen && value.length > maxLen) {
      return; // prevent exceeding max length
    }

    const updated = { ...draft, [field]: value };
    setDraft(updated);

    // Validate URL real-time if buttons are updated
    if (field === 'primary_button_url' || field === 'secondary_button_url') {
      validateUrls(updated);
    }
  };

  // URL protocol validations
  const validateUrls = (settings: HeroSettingsType): boolean => {
    const errors: Record<string, string> = {};
    const urlPattern = /^(\/|https:\/\/)/;

    if (settings.primary_button_url && !urlPattern.test(settings.primary_button_url)) {
      errors.primary_button_url = 'URLs must start with "/" (internal link) or "https://" (external link)';
    }

    if (settings.secondary_button_url && !urlPattern.test(settings.secondary_button_url)) {
      errors.secondary_button_url = 'URLs must start with "/" (internal link) or "https://" (external link)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateUrls(draft)) {
      toast.error('Please correct URL validation errors before saving.');
      return;
    }

    saveMutation.mutate(draft);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset Hero CMS settings to the default template values?')) {
      setDraft({ ...STATIC_HERO });
      setValidationErrors({});
    }
  };

  // Media Library triggers
  const openMediaPicker = (field: 'hero_image' | 'background_image') => {
    setMediaTargetField(field);
    setMediaOpen(true);
  };

  const handleMediaSelect = (url: string) => {
    if (mediaTargetField) {
      setDraft(prev => ({ ...prev, [mediaTargetField]: url }));
      setMediaTargetField(null);
    }
    setMediaOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mr-3" />
        <span className="text-muted-foreground mt-4 font-medium">Loading Hero CMS settings...</span>
      </div>
    );
  }

  const isFormValid = Object.keys(validationErrors).length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground">Hero Section Settings</h2>
          <p className="text-sm text-muted-foreground">Manage the landing page hero title, description, buttons, and visuals.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetToDefaults}>
            Reset to Template
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending || !isFormValid}
            size="sm"
            className="shadow-sm font-semibold"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {isError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-amber-500 font-semibold text-sm">Database Sync Notice</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Could not query active database settings. The storefront landing page is automatically displaying the default static template hero. You can edit settings below and click Save to provision/update the custom database settings.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Editor Form Panel */}
        <Card className="border-border/40 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Content Editor</CardTitle>
            <CardDescription>Update text and configurations with safety limit checks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Badge Text */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="badge_text" className="text-sm font-semibold">Badge Banner Text</Label>
                <span className="text-[10px] text-muted-foreground">{draft.badge_text?.length || 0}/40</span>
              </div>
              <Input
                id="badge_text"
                value={draft.badge_text || ''}
                onChange={(e) => handleInputChange('badge_text', e.target.value, 40)}
                placeholder="e.g. 100% Homemade"
                className="h-11 rounded-lg"
              />
            </div>

            {/* Title */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="title" className="text-sm font-semibold">Hero Main Title</Label>
                <span className="text-[10px] text-muted-foreground">{draft.title.length}/120</span>
              </div>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => handleInputChange('title', e.target.value, 120)}
                placeholder="Enter title text"
                required
                className="h-11 rounded-lg font-serif"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="subtitle" className="text-sm font-semibold">Subtitle / Tagline</Label>
                <span className="text-[10px] text-muted-foreground">{draft.subtitle.length}/200</span>
              </div>
              <Input
                id="subtitle"
                value={draft.subtitle}
                onChange={(e) => handleInputChange('subtitle', e.target.value, 200)}
                placeholder="Enter tagline text"
                required
                className="h-11 rounded-lg"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="description" className="text-sm font-semibold">Detailed Description</Label>
                <span className="text-[10px] text-muted-foreground">{(draft.description || '').length}/500</span>
              </div>
              <Textarea
                id="description"
                value={draft.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value, 500)}
                placeholder="Enter rich paragraph text..."
                rows={4}
                className="rounded-lg resize-y"
              />
            </div>

            {/* Buttons / CTA 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label htmlFor="primary_button_text" className="text-sm font-semibold">Primary CTA Text</Label>
                  <span className="text-[10px] text-muted-foreground">{(draft.primary_button_text || '').length}/30</span>
                </div>
                <Input
                  id="primary_button_text"
                  value={draft.primary_button_text || ''}
                  onChange={(e) => handleInputChange('primary_button_text', e.target.value, 30)}
                  placeholder="e.g. Shop Now"
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="primary_button_url" className="text-sm font-semibold">Primary CTA Link</Label>
                <Input
                  id="primary_button_url"
                  value={draft.primary_button_url || ''}
                  onChange={(e) => handleInputChange('primary_button_url', e.target.value)}
                  placeholder="e.g. /menu or https://..."
                  className={`h-11 rounded-lg ${validationErrors.primary_button_url ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {validationErrors.primary_button_url && (
                  <p className="text-[11px] text-red-500 mt-1">{validationErrors.primary_button_url}</p>
                )}
              </div>
            </div>

            {/* Buttons / CTA 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label htmlFor="secondary_button_text" className="text-sm font-semibold">Secondary CTA Text</Label>
                  <span className="text-[10px] text-muted-foreground">{(draft.secondary_button_text || '').length}/30</span>
                </div>
                <Input
                  id="secondary_button_text"
                  value={draft.secondary_button_text || ''}
                  onChange={(e) => handleInputChange('secondary_button_text', e.target.value, 30)}
                  placeholder="e.g. Explore Collection"
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="secondary_button_url" className="text-sm font-semibold">Secondary CTA Link</Label>
                <Input
                  id="secondary_button_url"
                  value={draft.secondary_button_url || ''}
                  onChange={(e) => handleInputChange('secondary_button_url', e.target.value)}
                  placeholder="e.g. /menu or https://..."
                  className={`h-11 rounded-lg ${validationErrors.secondary_button_url ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {validationErrors.secondary_button_url && (
                  <p className="text-[11px] text-red-500 mt-1">{validationErrors.secondary_button_url}</p>
                )}
              </div>
            </div>

            {/* Visuals Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Hero Main Image</Label>
                {draft.hero_image ? (
                  <div className="relative rounded-lg border overflow-hidden aspect-video bg-muted group">
                    <img src={draft.hero_image} alt="Hero picker" className="object-cover w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="destructive" size="sm" onClick={() => setDraft(prev => ({ ...prev, hero_image: '' }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-24 border-dashed rounded-lg flex flex-col items-center justify-center" onClick={() => openMediaPicker('hero_image')}>
                    <ImageIcon className="h-6 w-6 text-muted-foreground/60 mb-2" />
                    <span className="text-xs font-semibold">Choose from Media Library</span>
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Background Overlay Image</Label>
                {draft.background_image ? (
                  <div className="relative rounded-lg border overflow-hidden aspect-video bg-muted group">
                    <img src={draft.background_image} alt="BG overlay" className="object-cover w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="destructive" size="sm" onClick={() => setDraft(prev => ({ ...prev, background_image: '' }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-24 border-dashed rounded-lg flex flex-col items-center justify-center" onClick={() => openMediaPicker('background_image')}>
                    <ImageIcon className="h-6 w-6 text-muted-foreground/60 mb-2" />
                    <span className="text-xs font-semibold">Choose from Media Library</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview Panel */}
        <Card className="border-border/40 shadow-sm rounded-2xl overflow-hidden sticky top-6">
          <CardHeader className="bg-secondary/5 border-b flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg font-serif">Live Responsive Preview</CardTitle>
              <CardDescription>Simulates live rendering of edited content.</CardDescription>
            </div>
            <div className="flex bg-muted rounded-lg p-0.5 border border-border/40 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'desktop' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              >
                <Laptop className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'mobile' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-muted/20">
            <div className="flex items-center justify-center p-6 min-h-[450px]">
              <div 
                className={`bg-background border rounded-2xl shadow-xl overflow-hidden transition-all duration-300 relative ${activeTab === 'desktop' ? 'w-full max-w-2xl min-h-[350px]' : 'w-[320px] min-h-[450px]'}`}
                style={{
                  backgroundImage: draft.background_image ? `url(${draft.background_image})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {/* Hero Section Live Visual Mock */}
                <div className={`p-8 flex flex-col justify-center h-full min-h-[350px] bg-gradient-to-r from-background/95 via-background/90 to-background/40`}>
                  <div className="max-w-[450px] space-y-4">
                    {/* Badge */}
                    {draft.badge_text && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wider">
                        {draft.badge_text}
                      </span>
                    )}

                    {/* Title */}
                    <h1 className={`font-serif font-bold text-foreground leading-tight ${activeTab === 'desktop' ? 'text-3xl' : 'text-xl'}`}>
                      {draft.title}
                    </h1>

                    {/* Subtitle */}
                    <p className="text-sm font-medium text-primary">
                      {draft.subtitle}
                    </p>

                    {/* Description */}
                    {draft.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {draft.description}
                      </p>
                    )}

                    {/* CTA Buttons */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {draft.primary_button_text && (
                        <Button size="sm" className="gap-1.5 font-semibold text-xs h-9 rounded-lg">
                          {draft.primary_button_text}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {draft.secondary_button_text && (
                        <Button size="sm" variant="outline" className="font-semibold text-xs h-9 rounded-lg">
                          {draft.secondary_button_text}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Simulated Floating Hero Image */}
                {draft.hero_image && activeTab === 'desktop' && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 w-48 aspect-square rounded-2xl overflow-hidden border shadow-lg bg-background/50 backdrop-blur-sm">
                    <img src={draft.hero_image} alt="Hero Main visual" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Media Picker Drawer */}
      <MediaLibraryDrawer
        open={mediaOpen}
        onClose={() => {
          setMediaOpen(false);
          setMediaTargetField(null);
        }}
        onSelect={handleMediaSelect}
        defaultFolder="cms"
      />
    </div>
  );
}
