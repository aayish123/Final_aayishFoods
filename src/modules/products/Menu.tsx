import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import FoodCard from '@/components/FoodCard';
import SocialIcons from '@/components/SocialIcons';
import ComingSoon from '@/components/ComingSoon';
import SEOHead from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useProductsList } from '@/shared/hooks/useProductsList';
import { useCategories } from '@/shared/hooks/useCategories';
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

const Menu = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // React Query hooks
  const { data: rawProducts, isLoading: productsLoading } = useProductsList({ status: 'published' });
  const { data: rawCategories, isLoading: categoriesLoading } = useCategories();

  useEffect(() => {
    // Check for category parameter in URL
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

  // Transform rawProducts to conform with the page's FoodItem interface
  const foodItems: FoodItem[] = (rawProducts || []).map((item: any) => ({
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

  // Categories list helper
  const categories = ['All', ...(rawCategories?.map((c: any) => c.name) || [])];

  // Filter items
  let filteredItems = foodItems;

  // Filter by search term
  if (searchTerm.trim()) {
    filteredItems = filteredItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Filter by category
  if (selectedCategory !== 'All') {
    filteredItems = filteredItems.filter(item => item.category === selectedCategory);
  }

  const loading = productsLoading || categoriesLoading;

  // Generate structured data for menu
  const menuStructuredData = {
    "@context": "https://schema.org",
    "@type": "Menu",
    "name": "AAYISH Foods Menu",
    "description": "Complete menu of authentic Indian food including pickles, curries, and traditional delicacies",
    "url": "https://www.aayishfoods.online/menu",
    "hasMenuSection": categories.filter(cat => cat !== 'All').map(category => ({
      "@type": "MenuSection",
      "name": category,
      "description": `Authentic Indian ${category.toLowerCase()} items`,
      "hasMenuItem": filteredItems
        .filter(item => item.category === category)
        .map(item => ({
          "@type": "MenuItem",
          "name": item.name,
          "description": item.description || `Delicious ${item.name}`,
          "image": item.image_url || "https://www.aayishfoods.online/placeholder.svg",
          "offers": {
            "@type": "Offer",
            "price": item.variants[0]?.price || 0,
            "priceCurrency": "INR",
            "availability": item.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
          }
        }))
    }))
  };

  return (
    <div className="min-h-screen bg-background pt-10 pb-24">
      <SEOHead
        title="Indian Food Menu - Chicken Curry, Mango Pickle, Gongura Pickle | AAYISH Foods"
        description="Browse our complete menu of authentic Indian food. Order chicken curry, mango pickle, gongura pickle, tomato pickle, lemon pickle, and traditional Indian delicacies online. Fast delivery across India."
        keywords="Indian food menu, chicken curry menu, mango pickle menu, gongura pickle menu, tomato pickle menu, Indian pickles menu, traditional Indian food menu, authentic Indian cuisine menu, food delivery menu, online food ordering menu, Indian delicacies menu, homemade pickles menu, chicken pickle menu, lemon pickle menu, pandu mirchi pickle menu, bitter gourd pickle menu"
        url="https://www.aayishfoods.online/menu"
        structuredData={menuStructuredData}
      />
      <SocialIcons />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-primary font-bold tracking-widest uppercase text-sm mb-2 block">Our Offerings</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">The Menu</h1>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full mb-6"></div>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Explore our delicious collection of authentic Indian food, pickles, and snacks
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-12 space-y-4">
          <div className="max-w-xl mx-auto">
            <Input
              type="text"
              placeholder="Search for food items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 rounded-full px-6 shadow-sm border-border/50 focus-visible:ring-primary focus-visible:border-primary text-base"
            />
          </div>
          
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-6 transition-all min-h-[44px] ${
                  selectedCategory === category 
                    ? 'bg-primary text-white border-primary shadow-md hover:bg-primary/90' 
                    : 'bg-white hover:border-primary hover:text-primary border-border text-muted-foreground'
                }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Food Items Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-md border border-border/40 animate-pulse overflow-hidden">
                <div className="h-48 bg-muted"></div>
                <div className="p-5">
                  <div className="h-5 bg-muted rounded mb-3 w-3/4"></div>
                  <div className="h-4 bg-muted rounded mb-4 w-full"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {filteredItems.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </div>
        ) : selectedCategory === 'Snacks' ? (
          <div className="py-12">
            <ComingSoon 
              category="Snacks" 
              description="Delicious snacks and munchies are coming soon! Get ready for crispy, crunchy, and flavorful treats that will satisfy your cravings."
            />
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-border/50 shadow-sm max-w-2xl mx-auto">
            <p className="text-muted-foreground text-xl mb-6">No items found matching your criteria.</p>
            {searchTerm && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                }}
                className="rounded-full border-2 hover:bg-secondary/20 transition-all"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;
