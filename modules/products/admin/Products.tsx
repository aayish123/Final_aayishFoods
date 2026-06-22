import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { productService } from '@/shared/services/productService';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { useProductsList } from '@/shared/hooks/useProductsList';
import { useCategories } from '@/shared/hooks/useCategories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  in_stock: boolean | null;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived' | 'hidden';
  slug: string;
  short_description: string | null;
  category_id: string | null;
  categories?: {
    name: string;
  } | null;
  food_item_variants?: {
    id: string;
    weight: string | null;
    price: number;
    stock: number;
  }[];
}

export default function AdminProducts() {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  
  // Filtering & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedStock, setSelectedStock] = useState('all');

  // React Query hooks
  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useProductsList();
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: (_, id) => {
      auditService.log('delete', 'product', id, { deleted_id: id }, null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
    },
    onError: (err: any) => {
      toast.error(`Delete failed: ${err.message}`);
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: Product) => {
      const name = `${product.name} (Copy)`;
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim();
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const slug = `${baseSlug}-${uniqueSuffix}`;

      // 1. Insert duplicated product
      const { data: newProd, error: prodErr } = await supabase
        .from('food_items')
        .insert({
          name,
          slug,
          price: product.price,
          description: (product as any).description || '',
          short_description: product.short_description,
          category: product.category,
          category_id: product.category_id,
          image_url: product.image_url,
          in_stock: product.in_stock,
          status: 'draft', // duplicated products default to draft
          tags: (product as any).tags || [],
          search_keywords: (product as any).search_keywords || [],
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // 2. Insert product variants if any exist
      if (product.food_item_variants && product.food_item_variants.length > 0) {
        const { data: fullVariants } = await supabase
          .from('food_item_variants')
          .select('*')
          .eq('food_item_id', product.id);

        if (fullVariants && fullVariants.length > 0) {
          const variantsPayload = fullVariants.map(v => ({
            food_item_id: newProd.id,
            label: v.label,
            price: v.price,
            name: v.name ? `${v.name} (Copy)` : null,
            weight: v.weight,
            mrp: v.mrp,
            sku: v.sku ? `${v.sku}-COPY` : null,
            status: v.status,
            stock: 0, // Duplicated starts with 0 stock
          }));

          const { error: varErr } = await supabase
            .from('food_item_variants')
            .insert(variantsPayload);

          if (varErr) throw varErr;
        }
      }

      await auditService.log(
        'duplicate',
        'product',
        newProd.id,
        { source_id: product.id },
        { name, slug, status: 'draft' }
      );

      return newProd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Duplicated successfully as Draft!');
    },
    onError: (err: any) => {
      toast.error(`Duplication failed: ${err.message}`);
    }
  });

  const handleDuplicate = (product: Product) => {
    duplicateMutation.mutate(product);
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Delete Product Listing',
      message: 'Are you sure you want to delete this product? All related variants, reviews, and SEO entries will be permanently deleted.',
      confirmText: 'Delete Product',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        deleteMutation.mutate(id);
      }
    });
  };

  const getProductStockStatus = (product: Product) => {
    const variants = product.food_item_variants || [];
    if (variants.length === 0) return { label: 'No Variants', color: 'bg-gray-100 text-gray-500' };

    const totalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    if (totalStock === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (totalStock <= 10) return { label: `Low Stock (${totalStock})`, color: 'bg-amber-100 text-amber-800' };
    return { label: `In Stock (${totalStock})`, color: 'bg-green-100 text-green-800' };
  };

  const getPublishBadge = (status: Product['status']) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-[#1a3b2b] text-[#d4af37] border border-[#d4af37]/20 uppercase text-[10px]">Published</Badge>;
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-600 uppercase text-[10px]">Draft</Badge>;
      case 'pending_review':
        return <Badge className="bg-orange-100 text-orange-800 uppercase text-[10px]">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800 uppercase text-[10px]">Approved</Badge>;
      case 'hidden':
        return <Badge className="bg-[#5c2018]/10 text-[#5c2018] uppercase text-[10px]">Hidden</Badge>;
      case 'archived':
        return <Badge className="bg-red-100 text-red-800 uppercase text-[10px]">Archived</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 uppercase text-[10px]">{status}</Badge>;
    }
  };

  const products: Product[] = (productsData || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description,
    image_url: p.image_url,
    category: p.category,
    in_stock: p.in_stock,
    status: p.status,
    slug: p.slug,
    short_description: p.short_description,
    category_id: p.category_id,
    tags: p.tags,
    search_keywords: p.search_keywords,
    categories: p.categories,
    food_item_variants: p.food_item_variants
  }));

  const categories = (categoriesData || []).map((c: any) => ({
    id: c.id,
    name: c.name
  }));

  // Perform client-side filtering matching search/category/status parameters
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.short_description && p.short_description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
    
    // Stock levels filter checks available aggregates
    let matchesStock = true;
    const totalStock = p.food_item_variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
    if (selectedStock === 'out') {
      matchesStock = totalStock === 0;
    } else if (selectedStock === 'low') {
      matchesStock = totalStock > 0 && totalStock <= 10;
    } else if (selectedStock === 'in') {
      matchesStock = totalStock > 10;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesStock;
  });

  const loading = productsLoading || categoriesLoading || deleteMutation.isPending || duplicateMutation.isPending;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Product Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">Manage food listings, variants, available stock levels, and publication states</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => refetchProducts()} variant="outline" className="h-11 border-gray-200 bg-white" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button asChild className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold rounded-xl h-11">
            <Link to="/admin/products/new">
              <Plus className="mr-2 h-5 w-5" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Advanced Filter Deck */}
      <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products by name, slug or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-gray-100 pt-4 text-xs font-semibold text-gray-500">
            <div className="flex gap-4 items-center">
              <span>Stock Status:</span>
              <div className="flex gap-2">
                {['all', 'in', 'low', 'out'].map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedStock(type)}
                    className={`px-3 py-1 rounded-full border transition-all uppercase text-[9px] ${
                      selectedStock === type
                        ? 'bg-[#1a3b2b] text-[#d4af37] border-[#1a3b2b]'
                        : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'out' ? 'Out of Stock' : type === 'low' ? 'Low Stock' : 'In Stock'}
                  </button>
                ))}
              </div>
            </div>
            <span>Found {filteredProducts.length} Items</span>
          </div>
        </CardContent>
      </Card>

      {/* Catalog Grid Table */}
      <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Product Image</th>
                  <th className="px-6 py-4">Product Details</th>
                  <th className="px-6 py-4">Publish State</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Stock Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 font-semibold">
                      Retrieving items catalog from staging...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      No products match selected filtrations.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const stock = getProductStockStatus(p);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="h-12 w-12 rounded-xl overflow-hidden border border-gray-100 bg-[#fdfbf7] shrink-0">
                            <img
                              src={p.image_url || '/placeholder.svg'}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900 leading-tight">{p.name}</p>
                          <p className="font-mono text-[10px] text-gray-400 mt-1">{p.slug}</p>
                          <p className="text-xs text-gray-500 mt-0.5 max-w-sm truncate">{p.short_description || 'No description set'}</p>
                        </td>
                        <td className="px-6 py-4">{getPublishBadge(p.status)}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-gray-700">
                            {p.categories?.name || p.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${stock.color}`}>
                            {stock.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDuplicate(p)}
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                            title="Duplicate as Draft"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(p.id)}
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
