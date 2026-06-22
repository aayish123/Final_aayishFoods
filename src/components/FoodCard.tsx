
import { useState, useEffect } from 'react';
import { Plus, Minus, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedImageUrl } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

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

interface FoodCardProps {
  item: FoodItem;
}

const FoodCard = ({ item }: FoodCardProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addItem, items, updateQuantity } = useCart();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      setIsWishlisted(false);
      return;
    }
    const checkWishlist = async () => {
      try {
        const { data, error } = await supabase
          .from('wishlists')
          .select('id')
          .eq('user_id', user.id)
          .eq('food_item_id', item.id)
          .maybeSingle();
        
        if (!error && data) {
          setIsWishlisted(true);
        }
      } catch (err) {
        console.error('Error checking wishlist:', err);
      }
    };
    checkWishlist();
  }, [user, item.id]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      openAuthModal();
      return;
    }

    try {
      if (isWishlisted) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('food_item_id', item.id);

        if (error) throw error;
        setIsWishlisted(false);
        toast.success('Removed from wishlist');
        
        await supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'profile_updated', // matches check constraints
          description: `Removed from wishlist: ${item.name}`,
          metadata: { food_item_id: item.id }
        });

        queryClient.invalidateQueries({ queryKey: ['wishlist', user.id] });
      } else {
        const { error } = await supabase
          .from('wishlists')
          .insert({
            user_id: user.id,
            food_item_id: item.id
          });

        if (error) throw error;
        setIsWishlisted(true);
        toast.success('Added to wishlist');
        
        await supabase.from('customer_activity').insert({
          customer_id: user.id,
          activity_type: 'profile_updated', // matches check constraints
          description: `Added to wishlist: ${item.name}`,
          metadata: { food_item_id: item.id }
        });

        queryClient.invalidateQueries({ queryKey: ['wishlist', user.id] });
      }
    } catch (err) {
      console.error('Error toggling wishlist:', err);
      toast.error('Failed to update wishlist');
    }
  };
  const variants = item.variants || [];
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || '');
  const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];

  if (!variants.length) {
    return (
      <Card className="opacity-60">
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg text-gray-900 mb-2">{item.name}</h3>
          <p className="text-red-600">No variants available</p>
        </CardContent>
      </Card>
    );
  }

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
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
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

  return (
    <Card 
      className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden border-border/50 ${
        isAnimating ? 'animate-pulse scale-[1.02]' : ''
      } ${!item.in_stock ? 'opacity-70 grayscale-[0.2]' : ''}`}
      onClick={(e) => {
        // Prevent navigation if clicking on select or buttons
        const target = e.target as HTMLElement;
        if (target.closest('select') || target.closest('button')) return;
        navigate(`/food/${item.id}`);
      }}
    >
      <CardContent className="p-0">
        <div className="relative overflow-hidden aspect-[4/3]">
          {/* Wishlist Button */}
          <button
            onClick={toggleWishlist}
            className="absolute top-3 right-3 z-10 p-2 bg-white/90 hover:bg-white text-muted-foreground hover:text-red-500 rounded-full shadow-sm border border-border/20 transition-all duration-300 hover:scale-105"
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
          </button>

          <img
            src={getOptimizedImageUrl(item.image_url)}
            alt={`${item.name} - Authentic Indian ${item.category || 'food'} from AAYISH Foods`}
            title={`Order ${item.name} online - Fresh and authentic Indian ${item.category || 'food'}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {!item.in_stock && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-white font-medium tracking-wider text-lg">Out of Stock</span>
            </div>
          )}
          {item.category && (
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-primary px-3 py-1 rounded-full text-xs font-semibold tracking-wide shadow-sm">
              {item.category}
            </span>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-serif font-bold text-xl text-foreground mb-2 group-hover:text-primary transition-colors">{item.name}</h3>
          {item.description && (
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2 leading-relaxed">{item.description}</p>
          )}
          {variants.length > 1 && (
            <div className="mb-4">
              <label htmlFor={`variant-${item.id}`} className="block text-xs font-medium text-foreground/80 mb-1.5 uppercase tracking-wider">Select Size</label>
              <select
                id={`variant-${item.id}`}
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value)}
                className="w-full border-border/60 bg-muted/30 rounded-md p-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
              >
                {variants.map(variant => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {variants.length === 1 && (
            <div className="mb-4 text-xs font-medium text-foreground/70 uppercase tracking-wider">{variants[0].label}</div>
          )}
          <div className="flex items-center justify-between mt-auto">
            <span className="text-2xl font-bold text-primary">₹{selectedVariant?.price}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-5 pt-0">
        {currentQuantity > 0 ? (
          <div className="flex items-center justify-between w-full bg-muted/50 p-1.5 rounded-lg border border-border/50">
            <div className="flex items-center space-x-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleUpdateQuantity(currentQuantity - 1)}
                className="h-11 w-11 md:h-8 md:w-8 rounded-md hover:bg-white hover:shadow-sm transition-all"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-semibold w-6 text-center">{currentQuantity}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleUpdateQuantity(currentQuantity + 1)}
                className="h-11 w-11 md:h-8 md:w-8 rounded-md hover:bg-white hover:shadow-sm transition-all text-primary"
                disabled={!item.in_stock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm font-bold text-foreground px-2">
              ₹{(selectedVariant.price * currentQuantity).toFixed(2)}
            </span>
          </div>
        ) : (
          <Button
            onClick={handleAddToCart}
            className="w-full h-11 md:h-10 font-medium tracking-wide shadow-sm hover:shadow-md transition-all"
            disabled={!item.in_stock}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default FoodCard;
