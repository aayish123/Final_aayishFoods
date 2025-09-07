import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Star, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SEOHead from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { toast } from 'sonner';

interface FoodItemVariant {
  id: string;
  label: string;
  price: number;
}

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  in_stock: boolean | null;
  variants: FoodItemVariant[];
}

const FoodItem = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const { addItem, items, updateQuantity } = useCart();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    if (id) {
      fetchFoodItem();
    }
  }, [id]);

  const fetchFoodItem = async () => {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('*, food_item_variants(id, label, price)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching food item:', error);
        toast.error('Food item not found');
        navigate('/menu');
        return;
      }

      const foodItem = {
        ...data,
        variants: data.food_item_variants || []
      };
      
      setItem(foodItem);
      if (foodItem.variants.length > 0) {
        setSelectedVariantId(foodItem.variants[0].id);
      }
    } catch (error) {
      console.error('Error fetching food item:', error);
      toast.error('Failed to load food item');
      navigate('/menu');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!item) {
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

  const selectedVariant = item.variants.find(v => v.id === selectedVariantId) || item.variants[0];
  const currentQuantity = items.find(cartItem => cartItem.id === item.id && cartItem.variantId === selectedVariantId)?.quantity || 0;

  const handleAddToCart = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!item.in_stock) {
      toast.error('This item is currently out of stock');
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

  // Generate structured data for individual food item
  const foodItemStructuredData = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "name": item.name,
    "description": item.description || `Delicious ${item.name} from AAYISH Foods`,
    "image": item.image_url || "https://www.aayishfoods.online/placeholder.svg",
    "category": item.category || "Indian Food",
    "offers": {
      "@type": "Offer",
      "price": selectedVariant.price,
      "priceCurrency": "INR",
      "availability": item.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Restaurant",
        "name": "AAYISH Foods"
      }
    },
    "nutrition": {
      "@type": "NutritionInformation",
      "description": "Authentic Indian food made with traditional recipes"
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead
        title={`${item.name} - Order Online | AAYISH Foods`}
        description={`Order ${item.name} online from AAYISH Foods. ${item.description || `Fresh and authentic Indian ${item.category || 'food'} delivered to your doorstep.`} Fast delivery across India.`}
        keywords={`${item.name}, ${item.name} online, ${item.name} delivery, ${item.category || 'Indian food'}, authentic Indian ${item.category || 'food'}, ${item.name} recipe, order ${item.name}, ${item.name} price, Indian food delivery, AAYISH Foods`}
        url={`https://www.aayishfoods.online/food/${item.id}`}
        image={item.image_url || "https://www.aayishfoods.online/placeholder.svg"}
        structuredData={foodItemStructuredData}
      />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="outline"
          onClick={() => navigate('/menu')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Menu
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg">
              <img
                src={item.image_url?.replace(/^public\//, '')}
                alt={`${item.name} - Authentic Indian ${item.category || 'food'} from AAYISH Foods`}
                title={`Order ${item.name} online - Fresh and authentic Indian ${item.category || 'food'}`}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{item.name}</h1>
              {item.category && (
                <span className="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  {item.category}
                </span>
              )}
              {item.description && (
                <p className="text-gray-600 text-lg leading-relaxed">{item.description}</p>
              )}
            </div>

            {/* Variants */}
            {item.variants.length > 1 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Select Quantity:</h3>
                <div className="space-y-2">
                  {item.variants.map(variant => (
                    <label key={variant.id} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="variant"
                        value={variant.id}
                        checked={selectedVariantId === variant.id}
                        onChange={e => setSelectedVariantId(e.target.value)}
                        className="text-orange-600"
                      />
                      <span className="text-gray-700">{variant.label}</span>
                      <span className="text-orange-600 font-semibold">₹{variant.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price and Add to Cart */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-3xl font-bold text-orange-600">₹{selectedVariant?.price}</span>
                  {item.variants.length === 1 && (
                    <span className="text-gray-600 ml-2">({selectedVariant?.label})</span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>30-45 min delivery</span>
                </div>
              </div>

              {currentQuantity > 0 ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuantity(currentQuantity - 1)}
                      className="h-10 w-10 p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-xl font-semibold">{currentQuantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuantity(currentQuantity + 1)}
                      className="h-10 w-10 p-0"
                      disabled={!item.in_stock}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-lg font-semibold text-gray-700">
                    Total: ₹{(selectedVariant.price * currentQuantity).toFixed(2)}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={handleAddToCart}
                  className="w-full h-12 text-lg"
                  disabled={!item.in_stock}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {!item.in_stock ? 'Out of Stock' : 'Add to Cart'}
                </Button>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Truck className="h-4 w-4 text-orange-600" />
                <span>Free Delivery</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-orange-600" />
                <span>Premium Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodItem;
