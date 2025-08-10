
import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useNavigate } from 'react-router-dom';
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

interface FoodCardProps {
  item: FoodItem;
}

const FoodCard = ({ item }: FoodCardProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const { addItem, items, updateQuantity } = useCart();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
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
      className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isAnimating ? 'animate-pulse scale-105' : ''
      } ${!item.in_stock ? 'opacity-60' : ''}`}
    >
      <CardContent className="p-0">
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={item.image_url || '/placeholder.svg'}
            alt={item.name}
            className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {!item.in_stock && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-white font-semibold text-lg">Out of Stock</span>
            </div>
          )}
          {item.category && (
            <span className="absolute top-2 left-2 bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-medium">
              {item.category}
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-lg text-gray-900 mb-2">{item.name}</h3>
          {item.description && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
          )}
          {variants.length > 1 && (
            <div className="mb-2">
              <label htmlFor={`variant-${item.id}`} className="block text-sm font-medium mb-1">Select Quantity:</label>
              <select
                id={`variant-${item.id}`}
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value)}
                className="w-full border rounded p-1"
              >
                {variants.map(variant => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label} - ₹{variant.price}
                  </option>
                ))}
              </select>
            </div>
          )}
          {variants.length === 1 && (
            <div className="mb-2 text-sm text-gray-600">{variants[0].label}</div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-orange-600">₹{selectedVariant?.price}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {currentQuantity > 0 ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpdateQuantity(currentQuantity - 1)}
                className="h-8 w-8 p-0"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-semibold">{currentQuantity}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpdateQuantity(currentQuantity + 1)}
                className="h-8 w-8 p-0"
                disabled={!item.in_stock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm font-medium text-gray-600">
              ₹{(selectedVariant.price * currentQuantity).toFixed(2)}
            </span>
          </div>
        ) : (
          <Button
            onClick={handleAddToCart}
            className="w-full"
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
