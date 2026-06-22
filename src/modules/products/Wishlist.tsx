import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { supabase } from '@/integrations/supabase/client';
import FoodCard from '@/components/FoodCard';
import SocialIcons from '@/components/SocialIcons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWishlist } from '@/shared/hooks/useWishlist';
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

export default function WishlistComponent() {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: wishlistData, isLoading: loading, clearWishlist } = useWishlist(user?.id);

  useEffect(() => {
    if (!user) {
      openAuthModal();
      return;
    }
  }, [user, openAuthModal]);

  // Cast wishlist data properly
  const items: FoodItem[] = (wishlistData || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    image_url: item.image_url,
    category: item.category,
    in_stock: item.in_stock,
    variants: (item.food_item_variants || []).map((v: any) => ({
      id: v.id,
      label: v.label,
      price: v.price
    }))
  }));

  const handleClearWishlist = async () => {
    if (!user || items.length === 0) return;
    if (!window.confirm('Are you sure you want to clear your entire wishlist?')) return;

    try {
      await clearWishlist();
      toast.success('Wishlist cleared');
    } catch (err) {
      console.error('Error clearing wishlist:', err);
      toast.error('Failed to clear wishlist');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SocialIcons />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 relative">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">My Wishlist</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full mb-6"></div>
          {items.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClearWishlist}
              className="relative mx-auto mt-4 sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 h-11 sm:h-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border/60 hover:border-destructive/30 rounded-xl transition-all flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <Card className="shadow-xl shadow-primary/5 border border-border/40 rounded-2xl overflow-hidden max-w-4xl mx-auto">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 mx-auto bg-secondary/30 rounded-full flex items-center justify-center mb-6">
                <Heart className="h-10 w-10 text-primary opacity-50" />
              </div>
              <p className="text-muted-foreground text-xl mb-8 font-medium">Your wishlist is empty</p>
              <Button onClick={() => navigate('/menu')} size="lg" className="rounded-full px-8 shadow-md">
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
            {items.map((product) => (
              <FoodCard key={product.id} item={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
