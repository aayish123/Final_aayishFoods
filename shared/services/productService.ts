import { supabase } from '@/integrations/supabase/client';

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  category: string;
  category_id: string | null;
  image_url: string;
  in_stock: boolean;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived' | 'hidden';
  slug: string;
  short_description: string;
  tags: string[];
  gallery_images: string[];
  search_keywords: string[];
}

export interface VariantInput {
  id?: string;
  name: string;
  weight: string;
  label: string;
  price: number;
  mrp: number;
  stock: number;
  sku: string;
  status: 'active' | 'inactive';
}

export interface SEOInput {
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
}

export const productService = {
  fetchProducts: async (filters?: { categoryId?: string; status?: string }) => {
    let query = supabase
      .from('food_items')
      .select('*, food_item_variants(*), categories:category_id (name)');
    
    if (filters?.categoryId && filters.categoryId !== 'all') {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status as any);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  fetchProductDetails: async (id: string) => {
    const { data, error } = await supabase
      .from('food_items')
      .select('*, food_item_variants(*, warehouse_stock(available_stock, reorder_level)), product_seo(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  fetchCategories: async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  createProduct: async (product: ProductInput, variants: Omit<VariantInput, 'id'>[], seo?: SEOInput) => {
    // 1. Insert product
    const { data: newProd, error: prodErr } = await supabase
      .from('food_items')
      .insert([product])
      .select()
      .single();
    if (prodErr) throw prodErr;

    // 2. Insert variants
    if (variants.length > 0) {
      const variantPayload = variants.map(v => ({
        food_item_id: newProd.id,
        name: v.name,
        weight: v.weight,
        label: v.label,
        price: v.price,
        mrp: v.mrp,
        stock: v.stock,
        sku: v.sku,
        status: v.status
      }));

      const { error: varErr } = await supabase
        .from('food_item_variants')
        .insert(variantPayload);
      if (varErr) throw varErr;
    }

    // 3. Insert SEO metadata
    if (seo) {
      const { error: seoErr } = await supabase
        .from('product_seo')
        .insert([{
          product_id: newProd.id,
          ...seo
        }]);
      if (seoErr) throw seoErr;
    }

    return newProd;
  },

  updateProduct: async (
    id: string, 
    product: Partial<ProductInput>, 
    variants: VariantInput[], 
    seo?: SEOInput
  ) => {
    // 1. Update product main metadata
    const { error: prodErr } = await supabase
      .from('food_items')
      .update(product)
      .eq('id', id);
    if (prodErr) throw prodErr;

    // 2. Delete variants that were removed in the form
    const keepVariantIds = variants.map(v => v.id).filter(Boolean) as string[];
    if (keepVariantIds.length > 0) {
      const { error: delErr } = await supabase
        .from('food_item_variants')
        .delete()
        .eq('food_item_id', id)
        .not('id', 'in', `(${keepVariantIds.join(',')})`);
      if (delErr) throw delErr;
    } else {
      const { error: delErr } = await supabase
        .from('food_item_variants')
        .delete()
        .eq('food_item_id', id);
      if (delErr) throw delErr;
    }

    // 3. Upsert/sync variants list
    const variantPromises = variants.map(async (v) => {
      if (v.id) {
        // Update existing variant
        const { error: varErr } = await supabase
          .from('food_item_variants')
          .update({
            name: v.name,
            weight: v.weight,
            label: v.label,
            price: v.price,
            mrp: v.mrp,
            stock: v.stock,
            sku: v.sku,
            status: v.status
          })
          .eq('id', v.id);
        if (varErr) throw varErr;
      } else {
        // Insert new variant
        const { error: varErr } = await supabase
          .from('food_item_variants')
          .insert([{
            food_item_id: id,
            name: v.name,
            weight: v.weight,
            label: v.label,
            price: v.price,
            mrp: v.mrp,
            stock: v.stock,
            sku: v.sku,
            status: v.status
          }]);
        if (varErr) throw varErr;
      }
    });

    await Promise.all(variantPromises);

    // 3. Upsert product SEO details
    if (seo) {
      const { data: existingSeo } = await supabase
        .from('product_seo')
        .select('id')
        .eq('product_id', id)
        .maybeSingle();

      if (existingSeo) {
        const { error: seoErr } = await supabase
          .from('product_seo')
          .update(seo)
          .eq('product_id', id);
        if (seoErr) throw seoErr;
      } else {
        const { error: seoErr } = await supabase
          .from('product_seo')
          .insert([{
            product_id: id,
            ...seo
          }]);
        if (seoErr) throw seoErr;
      }
    }

    return true;
  },

  deleteProduct: async (id: string) => {
    const { error } = await supabase
      .from('food_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },
  
  fetchWishlist: async (userId: string) => {
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        food_item_id,
        food_items (
          id,
          name,
          description,
          image_url,
          category,
          in_stock,
          food_item_variants (
            id,
            label,
            price
          )
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    
    interface DbWishlistRow {
      food_items: any | null;
    }

    return (data as unknown as DbWishlistRow[] || [])
      .map((row) => row.food_items)
      .filter((fi): fi is any => fi !== null);
  },

  clearWishlist: async (userId: string) => {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }
};
