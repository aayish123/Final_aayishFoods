import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Star, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEOHead from '@/components/SEOHead';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { toast } from 'sonner';
import { useProductDetails } from '@/shared/hooks/useProductDetails';
import { getOptimizedImageUrl } from '@/lib/utils';

interface WarehouseStock {
  available_stock: number;
  reorder_level: number;
}

interface FoodItemVariant {
  id: string;
  label: string;
  price: number;
  sku?: string | null;
  weight?: string | null;
  mrp?: number | null;
  warehouse_stock?: WarehouseStock[];
}

interface ProductSEO {
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  faq_schema: unknown;
}

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  in_stock: boolean | null;
  variants: FoodItemVariant[];
  product_seo?: ProductSEO | null;
}

const FoodItemComponent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity } = useCart();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  
  const [selectedVariantId, setSelectedVariantId] = useState('');

  // Use React Query hook
  const { data: rawData, isLoading: queryLoading, error: queryError } = useProductDetails(id);

  // Set default selected variant when data finishes loading
  useEffect(() => {
    if (rawData?.food_item_variants && rawData.food_item_variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(rawData.food_item_variants[0].id);
    }
  }, [rawData, selectedVariantId]);

  // Handle errors or missing product
  useEffect(() => {
    if (queryError) {
      toast.error('Failed to load food item');
      navigate('/menu');
    }
  }, [queryError, navigate]);

  if (queryLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!rawData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Food Item Not Found</h1>
          <Button onClick={() => navigate('/menu')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  const item: FoodItem = {
    id: rawData.id,
    name: rawData.name,
    description: rawData.description,
    image_url: rawData.image_url,
    category: rawData.category,
    in_stock: rawData.in_stock,
    variants: (rawData.food_item_variants || []).map((v: any) => ({
      id: v.id,
      label: v.label,
      price: v.price,
      sku: v.sku,
      weight: v.weight,
      mrp: v.mrp,
      warehouse_stock: v.warehouse_stock || []
    })),
    product_seo: rawData.product_seo
  };

  const selectedVariant = item.variants.find(v => v.id === selectedVariantId) || item.variants[0];
  const currentQuantity = items.find(cartItem => cartItem.id === item.id && cartItem.variantId === selectedVariantId)?.quantity || 0;

  const selectedVariantAvailableStock = selectedVariant?.warehouse_stock?.reduce((sum, ws) => sum + (ws.available_stock || 0), 0) || 0;
  const isVariantInStock = selectedVariantAvailableStock > 0;

  const handleAddToCart = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!isVariantInStock) {
      toast.error('This variant is currently out of stock');
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: selectedVariant.price,
      image_url: item.image_url || undefined,
      variantId: selectedVariant.id,
      variantLabel: selectedVariant.label
    });
    toast.success(`${item.name} (${selectedVariant.label}) added to cart!`);
  };

  const handleUpdateQuantity = (newQuantity: number) => {
    updateQuantity(item.id, newQuantity, selectedVariantId);
  };

  const getStockStatus = (v: FoodItemVariant) => {
    const availableStock = v.warehouse_stock?.reduce((sum, ws) => sum + (ws.available_stock || 0), 0) || 0;
    const reorderLevel = v.warehouse_stock?.[0]?.reorder_level || 5;

    if (availableStock <= 0) {
      return { label: 'Out Of Stock', color: 'text-red-600 bg-red-50 border-red-200' };
    } else if (availableStock <= reorderLevel) {
      return { label: 'Low Stock', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    } else {
      return { label: 'In Stock', color: 'text-green-600 bg-green-50 border-green-200' };
    }
  };

  // Generate SEO-friendly slug
  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const itemSlug = generateSlug(item.name);

  // Generate rich graph schema (Breadcrumb, Organization, Product)
  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.aayishfoods.online"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": item.category || "Menu",
        "item": `https://www.aayishfoods.online/menu?category=${item.category || ''}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": item.name,
        "item": `https://www.aayishfoods.online/food/${itemSlug}`
      }
    ]
  };

  const organizationSchema = {
    "@type": "Organization",
    "@id": "https://www.aayishfoods.online/#organization",
    "name": "AAYISH Foods",
    "url": "https://www.aayishfoods.online",
    "logo": "https://www.aayishfoods.online/logo.png"
  };

  const productSchema = {
    "@type": "Product",
    "name": item.name,
    "description": item.description || `Delicious ${item.name} from AAYISH Foods`,
    "image": item.image_url || "https://www.aayishfoods.online/placeholder.svg",
    "category": item.category || "Indian Food",
    "url": `https://www.aayishfoods.online/food/${itemSlug}`,
    "sku": selectedVariant?.sku || item.id,
    "offers": {
      "@type": "Offer",
      "price": selectedVariant?.price || 0,
      "priceCurrency": "INR",
      "priceValidUntil": new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
      "availability": isVariantInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "url": `https://www.aayishfoods.online/food/${itemSlug}`,
      "seller": {
        "@id": "https://www.aayishfoods.online/#organization"
      }
    }
  };

  const combinedStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema,
      breadcrumbSchema,
      productSchema
    ]
  };

  return (
    <div className="min-h-screen bg-background pt-8 pb-24">
      <SEOHead
        title={item.product_seo?.seo_title || `${item.name} - Order Online | AAYISH Foods`}
        description={item.product_seo?.seo_description || `Order ${item.name} online from AAYISH Foods. ${item.description || `Fresh and authentic Indian ${item.category || 'food'} delivered to your doorstep.`} Fast delivery across India.`}
        keywords={item.product_seo?.seo_keywords || `${item.name}, ${item.name} online, ${item.name} delivery, ${item.category || 'Indian food'}, authentic Indian ${item.category || 'food'}, ${item.name} recipe, order ${item.name}, ${item.name} price, Indian food delivery, AAYISH Foods`}
        url={item.product_seo?.canonical_url || `https://www.aayishfoods.online/food/${item.id}`}
        image={item.product_seo?.og_image || item.image_url || "https://www.aayishfoods.online/placeholder.svg"}
        structuredData={combinedStructuredData}
      />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/menu')}
          className="mb-8 h-11 hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-all"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Menu
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Image */}
          <div className="space-y-4">
            <div className="aspect-[4/5] lg:aspect-square overflow-hidden rounded-2xl shadow-xl border border-border/40">
              <img
                src={getOptimizedImageUrl(item.image_url)}
                alt={`${item.name} - Authentic Indian ${item.category || 'food'} from AAYISH Foods`}
                title={`Order ${item.name} online - Fresh and authentic Indian ${item.category || 'food'}`}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-8 py-4 lg:sticky lg:top-28 h-fit">
            <div>
              {item.category && (
                <span className="inline-block bg-secondary/60 text-primary px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-4 shadow-sm">
                  {item.category}
                </span>
              )}
              <h1 className="text-4xl lg:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">{item.name}</h1>
              {item.description && (
                <p className="text-muted-foreground text-lg leading-relaxed mb-4">{item.description}</p>
              )}
              {selectedVariant && (
                <div className="mt-2">
                  {(() => {
                    const status = getStockStatus(selectedVariant);
                    return (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                        {status.label}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Variants */}
            {item.variants.length > 1 && (
              <div className="bg-white p-6 rounded-2xl border border-border/50 shadow-sm">
                <h3 className="text-sm font-semibold mb-4 text-foreground/80 uppercase tracking-wider">Select Size</h3>
                <div className="space-y-3">
                  {item.variants.map(variant => (
                    <label 
                      key={variant.id} 
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedVariantId === variant.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="variant"
                          value={variant.id}
                          checked={selectedVariantId === variant.id}
                          onChange={e => setSelectedVariantId(e.target.value)}
                          className="w-4 h-4 text-primary focus:ring-primary border-muted"
                        />
                        <span className="font-medium text-foreground">{variant.label}</span>
                      </div>
                      <span className="text-primary font-bold text-lg">₹{variant.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price and Add to Cart */}
            <div className="bg-white p-6 rounded-2xl border border-border/50 shadow-sm">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 font-medium tracking-wider uppercase">Price</p>
                  <span className="text-4xl font-bold text-primary">₹{selectedVariant?.price}</span>
                  {item.variants.length === 1 && (
                    <span className="text-muted-foreground ml-2 font-medium text-lg">({selectedVariant?.label})</span>
                  )}
                </div>
                <div className="flex flex-col items-end text-sm text-muted-foreground font-medium bg-secondary/20 px-3 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>30-45 min delivery</span>
                  </div>
                </div>
              </div>

              {currentQuantity > 0 ? (
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-xl border border-border/50">
                  <div className="flex items-center space-x-4">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleUpdateQuantity(currentQuantity - 1)}
                      className="h-12 w-12 rounded-lg hover:bg-white hover:text-primary transition-all shadow-sm"
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="text-2xl font-bold w-8 text-center">{currentQuantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleUpdateQuantity(currentQuantity + 1)}
                      className="h-12 w-12 rounded-lg hover:bg-white text-primary transition-all shadow-sm"
                      disabled={!isVariantInStock}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <span className="text-xl font-bold text-foreground px-4">
                    ₹{(selectedVariant.price * currentQuantity).toFixed(2)}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleAddToCart}
                  className="w-full h-14 text-lg rounded-xl font-semibold tracking-wide shadow-md hover:shadow-lg transition-all"
                  disabled={!isVariantInStock}
                >
                  <Plus className="h-6 w-6 mr-2" />
                  {!isVariantInStock ? 'Out of Stock' : 'Add to Cart'}
                </Button>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center space-x-3 bg-secondary/10 p-4 rounded-xl border border-secondary/20">
                <Truck className="h-6 w-6 text-primary" />
                <span className="font-medium text-foreground">Free Delivery</span>
              </div>
              <div className="flex items-center space-x-3 bg-secondary/10 p-4 rounded-xl border border-secondary/20">
                <Star className="h-6 w-6 text-primary" />
                <span className="font-medium text-foreground">Premium Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodItemComponent;
