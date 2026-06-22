import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MediaLibraryDrawer from '@/components/admin/MediaLibraryDrawer';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Globe,
  Settings,
  Grid,
} from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { useUnsavedChangesGuard } from '@/components/system/UnsavedChangesGuard';
import { useProductDetails } from '@/shared/hooks/useProductDetails';
import { useCreateProduct } from '@/shared/hooks/useCreateProduct';
import { useUpdateProduct } from '@/shared/hooks/useUpdateProduct';
import { useCategories } from '@/shared/hooks/useCategories';

interface CategoryOption {
  id: string;
  name: string;
}

interface Variant {
  id?: string;
  name: string;
  weight: string;
  price: number;
  mrp: number;
  stock: number;
  sku: string;
  status: 'active' | 'inactive';
}

export default function AdminProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useUnsavedChangesGuard(isDirty);

  // Tab State
  const [activeTab, setActiveTab] = useState('basic');

  // Media Library triggers
  const [mediaTarget, setMediaTarget] = useState<'primary' | 'gallery' | null>(null);
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  // Form State - Core Product
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [tagsInput, setTagsInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // Form State - Variants
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Standard Pack', weight: '250g', price: 0, mrp: 0, stock: 0, sku: '', status: 'active' }
  ]);

  // Form State - SEO (Separated Table)
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [isIndexable, setIsIndexable] = useState(true);

  // React Query queries/mutations
  const { data: rawProduct, isLoading: productLoading } = useProductDetails(id);
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  useEffect(() => {
    if (categoriesData) {
      setCategories(categoriesData.map((c: any) => ({ id: c.id, name: c.name })));
    }
  }, [categoriesData]);

  useEffect(() => {
    if (rawProduct && isEdit) {
      setName(rawProduct.name);
      setSlug(rawProduct.slug);
      setDescription(rawProduct.description || '');
      setShortDescription(rawProduct.short_description || '');
      setCategoryId(rawProduct.category_id || '');
      setStatus(rawProduct.status || 'draft');
      setImageUrl(rawProduct.image_url || '');
      setGalleryImages(rawProduct.gallery_images || []);
      setTagsInput(rawProduct.tags?.join(', ') || '');
      setKeywordsInput(rawProduct.search_keywords?.join(', ') || '');

      if (rawProduct.food_item_variants && rawProduct.food_item_variants.length > 0) {
        setVariants(
          rawProduct.food_item_variants.map((v: any) => ({
            id: v.id,
            name: v.name || v.label || '',
            weight: v.weight || v.label || '',
            price: Number(v.price),
            mrp: Number(v.mrp || v.price),
            stock: v.stock,
            sku: v.sku || '',
            status: v.status || 'active',
          }))
        );
      }

      if (rawProduct.product_seo) {
        setSeoTitle(rawProduct.product_seo.seo_title || '');
        setSeoDescription(rawProduct.product_seo.seo_description || '');
        setSeoKeywords(rawProduct.product_seo.seo_keywords || '');
        setCanonicalUrl(rawProduct.product_seo.canonical_url || '');
        setOgTitle(rawProduct.product_seo.og_title || '');
        setOgDescription(rawProduct.product_seo.og_description || '');
        setIsIndexable(rawProduct.product_seo.is_indexable);
      }
      setIsInitialLoad(false);
    } else if (!isEdit && !categoriesLoading) {
      setIsInitialLoad(false);
    }
  }, [rawProduct, isEdit, categoriesLoading]);

  useEffect(() => {
    if (!productLoading && !isInitialLoad) {
      setIsDirty(true);
    }
  }, [name, slug, description, shortDescription, categoryId, status, tagsInput, keywordsInput, imageUrl, galleryImages, variants, seoTitle, seoDescription, seoKeywords, canonicalUrl, ogTitle, ogDescription, isIndexable]);

  // SEO Template Generation
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);

    if (!isEdit) {
      const generatedSlug = val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim();
      setSlug(generatedSlug);
      setSeoTitle(`${val} | AAYISH Foods`);
      setOgTitle(`${val} - Authentic Homemade Pickles | Aayish`);
      setCanonicalUrl(`https://www.aayishfoods.online/food/${generatedSlug}`);
    }
  };

  const handleShortDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setShortDescription(val);
    if (!isEdit) {
      setSeoDescription(`Order authentic ${name} online. ${val.slice(0, 100)}... Traditional recipes and fast India-wide delivery.`);
      setOgDescription(`Buy traditional ${name} online. Handcrafted with authentic spices. Free delivery across India.`);
    }
  };

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      { name: '', weight: '', price: 0, mrp: 0, stock: 0, sku: '', status: 'active' }
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length === 1) {
      toast.warning('A product must have at least one variant.');
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = <K extends keyof Variant>(index: number, key: K, value: Variant[K]) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [key]: value };
    setVariants(updated);
  };

  const handleSelectMedia = (url: string) => {
    if (mediaTarget === 'primary') {
      setImageUrl(url);
    } else if (mediaTarget === 'gallery') {
      setGalleryImages([...galleryImages, url]);
    }
    setMediaTarget(null);
  };

  const handleRemoveGalleryImage = (idx: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Please enter name and slug');
      return;
    }

    try {
      const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
      const searchKeywords = keywordsInput ? keywordsInput.split(',').map(k => k.trim()).filter(Boolean) : [];
      const selectedCategoryName = categories.find(c => c.id === categoryId)?.name || null;

      // Base price is the price of the first variant
      const basePrice = variants[0]?.price || 0;

      const productPayload = {
        name,
        slug,
        price: basePrice,
        description: description || '',
        short_description: shortDescription || '',
        category: selectedCategoryName,
        category_id: categoryId === '' ? null : categoryId,
        image_url: imageUrl || '',
        in_stock: variants.some(v => v.stock > 0 && v.status === 'active'),
        status: status as any,
        tags,
        search_keywords: searchKeywords,
        gallery_images: galleryImages,
      };

      const seoPayload = {
        seo_title: seoTitle || `${name} | Aayish Foods`,
        seo_description: seoDescription || shortDescription || '',
        seo_keywords: seoKeywords || tagsInput || '',
        canonical_url: canonicalUrl || `https://www.aayishfoods.online/food/${slug}`,
        og_title: ogTitle || name,
        og_description: ogDescription || shortDescription || '',
        og_image: imageUrl || '',
        is_indexable: isIndexable,
      };

      const formattedVariants = variants.map(v => ({
        id: v.id,
        label: v.weight || v.name,
        name: v.name || '',
        weight: v.weight || '',
        price: v.price,
        mrp: v.mrp || v.price,
        stock: v.stock,
        sku: v.sku || '',
        status: v.status
      }));

      if (isEdit) {
        await updateMutation.mutateAsync({
          id: id!,
          product: productPayload,
          variants: formattedVariants,
          seo: seoPayload
        });
        await auditService.log(
          'update',
          'product',
          id!,
          { id },
          { name, price: basePrice, status }
        );
      } else {
        const newProd = await createMutation.mutateAsync({
          product: productPayload,
          variants: formattedVariants,
          seo: seoPayload
        });
        await auditService.log(
          'create',
          'product',
          newProd.id,
          null,
          { name, price: basePrice, status }
        );
      }

      window.formIsDirty = false;
      setIsDirty(false);
      toast.success(isEdit ? 'Product updated successfully' : 'Product created successfully');
      navigate('/admin/products');
    } catch (err: any) {
      toast.error(`Save Failed: ${err.message}`);
    }
  };

  const formLoading = productLoading || categoriesLoading || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => { window.formIsDirty = false; navigate('/admin/products'); }} className="hover:bg-gray-100 shrink-0">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Button>
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#5c2018]">
              {isEdit ? `Edit: ${name}` : 'Add New Product'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">Configure weights, pricing levels, imagery, and SEO metadata</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a3b2b]/5 border border-[#1a3b2b]/10 p-1 rounded-xl w-fit">
            <TabsTrigger value="basic" className="rounded-lg data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">Basic Information</TabsTrigger>
            <TabsTrigger value="variants" className="rounded-lg data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">Variants & Pricing</TabsTrigger>
            <TabsTrigger value="images" className="rounded-lg data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">Media Assets</TabsTrigger>
            <TabsTrigger value="seo" className="rounded-lg data-[state=active]:bg-[#1a3b2b] data-[state=active]:text-[#d4af37]">SEO Metadata</TabsTrigger>
          </TabsList>

          {/* TAB 1: BASIC INFORMATION */}
          <TabsContent value="basic" className="space-y-6 mt-6 focus-visible:outline-none">
            <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl">
              <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5 text-[#1a3b2b]" />
                  Core Product Attributes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="prod-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name *</Label>
                    <Input
                      id="prod-name"
                      value={name}
                      onChange={handleNameChange}
                      required
                      placeholder="e.g. Avakaya Pickle"
                      className="rounded-xl border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prod-slug" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Product Slug *</Label>
                    <Input
                      id="prod-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      required
                      placeholder="e.g. avakaya-pickle"
                      className="rounded-xl border-gray-200 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="prod-cat" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</Label>
                    <select
                      id="prod-cat"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                    >
                      <option value="">Choose Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prod-status" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Publishing Status *</Label>
                    <select
                      id="prod-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      required
                      className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                    >
                      <option value="draft">Draft</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="approved">Approved</option>
                      <option value="published">Published</option>
                      <option value="hidden">Hidden</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prod-shortdesc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Short Description (Summary)</Label>
                  <Textarea
                    id="prod-shortdesc"
                    value={shortDescription}
                    onChange={handleShortDescChange}
                    placeholder="Brief 1-2 sentence description for quick previews..."
                    className="rounded-xl border-gray-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prod-desc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Details & Description</Label>
                  <Textarea
                    id="prod-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide full description, recipes, ingredients, and shelf life details..."
                    className="rounded-xl border-gray-200 min-h-32"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="prod-tags" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Meta Tags (Comma separated)</Label>
                    <Input
                      id="prod-tags"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="pickle, homemade, spicy, mango"
                      className="rounded-xl border-gray-200 text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prod-search" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Search Keywords (Comma separated)</Label>
                    <Input
                      id="prod-search"
                      value={keywordsInput}
                      onChange={(e) => setKeywordsInput(e.target.value)}
                      placeholder="avakaya, andhra pickle, spicy pickle, mango achar"
                      className="rounded-xl border-gray-200 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: VARIANTS & PRICING */}
          <TabsContent value="variants" className="space-y-6 mt-6 focus-visible:outline-none">
            <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl">
              <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4 flex flex-row justify-between items-center">
                <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                  <Grid className="h-5 w-5 text-[#1a3b2b]" />
                  Product Quantity Variants
                </CardTitle>
                <Button type="button" onClick={handleAddVariant} className="bg-[#1a3b2b] text-[#d4af37] text-xs h-9">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Weight Variant
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {variants.map((v, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end bg-[#fdfbf7]/60 p-4 rounded-xl border border-gray-100">
                      <div className="space-y-1 md:col-span-1.5">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Variant Name</Label>
                        <Input
                          value={v.name}
                          onChange={(e) => handleVariantChange(index, 'name', e.target.value)}
                          placeholder="e.g. 250g Jar"
                          className="h-10 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Weight</Label>
                        <Input
                          value={v.weight}
                          onChange={(e) => handleVariantChange(index, 'weight', e.target.value)}
                          placeholder="e.g. 250g"
                          required
                          className="h-10 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MRP (₹)</Label>
                        <Input
                          type="number"
                          value={v.mrp}
                          onChange={(e) => handleVariantChange(index, 'mrp', parseFloat(e.target.value) || 0)}
                          required
                          className="h-10 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selling Price (₹)</Label>
                        <Input
                          type="number"
                          value={v.price}
                          onChange={(e) => handleVariantChange(index, 'price', parseFloat(e.target.value) || 0)}
                          required
                          className="h-10 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stock Qty</Label>
                        <Input
                          type="number"
                          value={v.stock}
                          onChange={(e) => handleVariantChange(index, 'stock', parseInt(e.target.value) || 0)}
                          required
                          className="h-10 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-1.5">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SKU Code</Label>
                        <Input
                          value={v.sku}
                          onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                          placeholder="e.g. AVK-250G"
                          className="h-10 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</Label>
                        <select
                          value={v.status}
                          onChange={(e) => handleVariantChange(index, 'status', e.target.value as any)}
                          className="w-full h-10 px-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveVariant(index)}
                          className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-800"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: MEDIA ASSETS */}
          <TabsContent value="images" className="space-y-6 mt-6 focus-visible:outline-none">
            <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl">
              <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-[#1a3b2b]" />
                  Product Visual Assets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="space-y-2 bg-[#fdfbf7]/60 p-4 rounded-xl border border-gray-100">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Primary Display Image</Label>
                  <div className="flex gap-6 items-center">
                    <div className="h-24 w-24 rounded-2xl border border-gray-200 overflow-hidden bg-white shrink-0">
                      <img src={imageUrl || '/placeholder.svg'} alt="Primary" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Image URL path"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="rounded-xl h-10"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          setMediaTarget('primary');
                          setIsMediaOpen(true);
                        }}
                        className="bg-[#1a3b2b] text-[#d4af37] text-xs h-9"
                      >
                        Browse Media Library
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gallery Images</Label>
                    <Button
                      type="button"
                      onClick={() => {
                        setMediaTarget('gallery');
                        setIsMediaOpen(true);
                      }}
                      variant="outline"
                      className="text-xs h-9 border-[#1a3b2b]/30 text-[#1a3b2b]"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Gallery Image
                    </Button>
                  </div>

                  {galleryImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 bg-[#fdfbf7]/60 p-4 rounded-xl border border-gray-100">
                      {galleryImages.map((img, idx) => (
                        <div key={idx} className="group relative aspect-square rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <img src={img} alt="Gallery" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(idx)}
                            className="absolute top-1.5 right-1.5 bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                      No gallery images uploaded.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: SEO METADATA */}
          <TabsContent value="seo" className="space-y-6 mt-6 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-white border border-[#1a3b2b]/10 rounded-2xl">
                <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
                  <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-[#1a3b2b]" />
                    Meta SEO Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="seo-title" className="text-xs font-bold text-gray-500 uppercase tracking-wider">SEO Title Tag</Label>
                      <Input
                        id="seo-title"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        placeholder="Page title"
                        className="rounded-xl border-gray-200 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo-keys" className="text-xs font-bold text-gray-500 uppercase tracking-wider">SEO Meta Keywords</Label>
                      <Input
                        id="seo-keys"
                        value={seoKeywords}
                        onChange={(e) => setSeoKeywords(e.target.value)}
                        placeholder="Keyword tags"
                        className="rounded-xl border-gray-200 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo-desc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Meta Description</Label>
                    <Textarea
                      id="seo-desc"
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      placeholder="Page description"
                      className="rounded-xl border-gray-200 text-xs h-20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="seo-canon" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Canonical URL</Label>
                      <Input
                        id="seo-canon"
                        value={canonicalUrl}
                        onChange={(e) => setCanonicalUrl(e.target.value)}
                        placeholder="Canonical path"
                        className="rounded-xl border-gray-200 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo-ogtitle" className="text-xs font-bold text-gray-500 uppercase tracking-wider">OpenGraph Title (Facebook/WhatsApp)</Label>
                      <Input
                        id="seo-ogtitle"
                        value={ogTitle}
                        onChange={(e) => setOgTitle(e.target.value)}
                        placeholder="OpenGraph title"
                        className="rounded-xl border-gray-200 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo-ogdesc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">OpenGraph Description</Label>
                    <Textarea
                      id="seo-ogdesc"
                      value={ogDescription}
                      onChange={(e) => setOgDescription(e.target.value)}
                      placeholder="OpenGraph description content..."
                      className="rounded-xl border-gray-200 text-xs h-20"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      id="seo-index"
                      type="checkbox"
                      checked={isIndexable}
                      onChange={(e) => setIsIndexable(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#1a3b2b] focus:ring-[#1a3b2b]"
                    />
                    <Label htmlFor="seo-index" className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer">Allow Search Engine Indexing (is_indexable)</Label>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden p-6 space-y-4 shadow-sm">
                  <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider block">Google Search Preview</span>
                  <div className="space-y-1 font-sans">
                    <p className="text-xs text-gray-500 font-medium truncate">https://www.aayishfoods.online › food › {slug || 'slug'}</p>
                    <h4 className="text-lg text-[#1a0dab] hover:underline cursor-pointer truncate font-medium">{seoTitle || name || 'Product Title'}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed max-w-md line-clamp-2">{seoDescription || shortDescription || 'Provide description details to preview search results snippet card here.'}</p>
                  </div>
                </Card>

                <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
                  <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-3">
                    <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider">Facebook OpenGraph Preview</span>
                  </CardHeader>
                  <div className="bg-gray-100 aspect-video overflow-hidden">
                    <img src={imageUrl || '/placeholder.svg'} alt="SEO og preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-100 font-sans">
                    <p className="text-[10px] text-gray-400 uppercase font-medium">aayishfoods.online</p>
                    <h5 className="text-sm font-semibold text-gray-800 truncate mt-1">{ogTitle || name || 'Product Title'}</h5>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{ogDescription || shortDescription || 'Description details...'}</p>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Global Save Controls */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={() => { window.formIsDirty = false; navigate('/admin/products'); }} className="rounded-xl h-12 px-6">
            Cancel
          </Button>
          <Button type="submit" disabled={formLoading} className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold rounded-xl h-12 px-8">
            <Save className="mr-2 h-5 w-5" />
            {formLoading ? 'Saving...' : 'Save Product Listing'}
          </Button>
        </div>
      </form>

      <MediaLibraryDrawer
        open={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        onSelect={handleSelectMedia}
        defaultFolder="products"
      />
    </div>
  );
}
