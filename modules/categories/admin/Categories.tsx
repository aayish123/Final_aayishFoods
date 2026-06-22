import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MediaLibraryDrawer from '@/components/admin/MediaLibraryDrawer';
import { Plus, Edit, Trash2, Folder, RefreshCw, FolderTree, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { useCategories } from '@/shared/hooks/useCategories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  display_order: number;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
}

export default function AdminCategories() {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywordsInput, setSeoKeywordsInput] = useState(''); // Comma separated

  // React Query hooks
  const { data: rawCategories, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (err: any) => {
      toast.error(`Delete failed: ${err.message}`);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (variables: { id?: string; payload: any }) => {
      if (variables.id) {
        const { error } = await supabase
          .from('categories')
          .update(variables.payload)
          .eq('id', variables.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert(variables.payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully');
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(`Save failed: ${err.message}`);
    }
  });

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setImageUrl('');
    setParentId('');
    setDisplayOrder('0');
    setSeoTitle('');
    setSeoDescription('');
    setSeoKeywordsInput('');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setSlug(category.slug);
    setDescription(category.description || '');
    setImageUrl(category.image_url || '');
    setParentId(category.parent_id || '');
    setDisplayOrder(category.display_order.toString());
    setSeoTitle(category.seo_title || '');
    setSeoDescription(category.seo_description || '');
    setSeoKeywordsInput(category.seo_keywords?.join(', ') || '');
    setIsDialogOpen(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!editingCategory) {
      // Auto-generate slug for new category
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .trim()
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Please fill in required fields (Name, Slug)');
      return;
    }

    const keywordsArray = seoKeywordsInput
      ? seoKeywordsInput.split(',').map((k) => k.trim()).filter(Boolean)
      : null;

    const payload = {
      name,
      slug,
      description: description || null,
      image_url: imageUrl || null,
      parent_id: parentId === '' ? null : parentId,
      display_order: parseInt(displayOrder) || 0,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      seo_keywords: keywordsArray,
    };

    saveMutation.mutate({
      id: editingCategory?.id,
      payload
    });
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? All child food items will lose their category references.',
      confirmText: 'Delete Category',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        deleteMutation.mutate(id);
      }
    });
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    return categories.find((c) => c.id === parentId)?.name || 'Unknown';
  };

  const categories: Category[] = (rawCategories || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image_url: c.image_url,
    parent_id: c.parent_id,
    display_order: c.display_order,
    seo_title: c.seo_title,
    seo_description: c.seo_description,
    seo_keywords: c.seo_keywords
  }));

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const loading = categoriesLoading || saveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Category Library</h1>
          <p className="text-gray-500 text-sm mt-1">Manage hierarchical menu segments, listings, and SEO visibility links</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => refetchCategories()} variant="outline" className="h-11 border-gray-200 bg-white" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button onClick={handleOpenAdd} className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold rounded-xl h-11">
            <Plus className="mr-2 h-5 w-5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[#1a3b2b]/5 flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-gray-200"
            />
          </div>
          <FolderTree className="h-5 w-5 text-[#1a3b2b]" />
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Image</th>
                  <th className="px-6 py-4">Category Name</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Parent</th>
                  <th className="px-6 py-4">Display Order</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400 font-medium">
                      Loading categories from database...
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">
                      No categories found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="h-10 w-10 rounded-lg overflow-hidden border border-gray-100 bg-[#fdfbf7]">
                          <img
                            src={c.image_url || '/placeholder.svg'}
                            alt={c.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{c.slug}</td>
                      <td className="px-6 py-4 text-gray-600">{getParentName(c.parent_id)}</td>
                      <td className="px-6 py-4 font-bold text-[#1a3b2b]">{c.display_order}</td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(c)}
                          className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(c.id)}
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Categories Add/Edit dialog form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#fdfbf7] border border-[#1a3b2b]/10 rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="border-b border-[#1a3b2b]/5 pb-4">
            <DialogTitle className="font-serif text-[#5c2018] text-2xl font-bold flex items-center gap-2">
              <Folder className="h-6 w-6 text-[#1a3b2b]" />
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Configure name, hierarchy links, display priority, and meta tags.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cat-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category Name *</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={handleNameChange}
                  required
                  placeholder="e.g. Traditional Pickles"
                  className="rounded-xl border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-slug" className="text-xs font-bold text-gray-500 uppercase tracking-wider">URL Slug *</Label>
                <Input
                  id="cat-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  required
                  placeholder="e.g. traditional-pickles"
                  className="rounded-xl border-gray-200 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</Label>
              <Textarea
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of category offerings..."
                className="rounded-xl border-gray-200"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cat-parent" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Parent Category</Label>
                <select
                  id="cat-parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                >
                  <option value="">No Parent (Root Category)</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id) // Prevent self-referencing hierarchy loops
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-order" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Display Order (Display Priority)</Label>
                <Input
                  id="cat-order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                  className="rounded-xl border-gray-200"
                />
              </div>
            </div>

            {/* Media Selector integration */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-gray-100">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Category Image</Label>
              <div className="flex gap-4 items-center">
                <div className="h-16 w-16 rounded-xl border border-gray-200 overflow-hidden bg-[#fdfbf7] shrink-0">
                  <img src={imageUrl || '/placeholder.svg'} alt="Preview" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Input
                    placeholder="Past image URL path or select from media drawer"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="rounded-lg h-9 text-xs"
                  />
                  <Button
                    type="button"
                    onClick={() => setIsMediaOpen(true)}
                    variant="outline"
                    className="h-8 text-xs border-gray-200 rounded-lg"
                  >
                    Browse Media Drawer
                  </Button>
                </div>
              </div>
            </div>

            {/* SEO accordion section */}
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <h3 className="font-serif text-[#5c2018] text-base font-bold">SEO Visibility Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cat-seotitle" className="text-xs font-bold text-gray-500 uppercase tracking-wider">SEO Title Tag</Label>
                  <Input
                    id="cat-seotitle"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="defaults to Category Name"
                    className="rounded-xl border-gray-200 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cat-seokeys" className="text-xs font-bold text-gray-500 uppercase tracking-wider">SEO Keywords (Comma separated)</Label>
                  <Input
                    id="cat-seokeys"
                    value={seoKeywordsInput}
                    onChange={(e) => setSeoKeywordsInput(e.target.value)}
                    placeholder="pickles, dynamic, mango pickle"
                    className="rounded-xl border-gray-200 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-seodesc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">SEO Description Tag</Label>
                <Textarea
                  id="cat-seodesc"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Defaults to description text summary..."
                  className="rounded-xl border-gray-200 text-xs h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl px-6" disabled={loading}>
                {loading ? 'Saving...' : 'Save Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MediaLibraryDrawer
        open={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        onSelect={(url) => setImageUrl(url)}
        defaultFolder="categories"
      />
    </div>
  );
}
