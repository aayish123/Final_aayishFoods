
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import FoodCard from '@/components/FoodCard';
import SocialIcons from '@/components/SocialIcons';
import ComingSoon from '@/components/ComingSoon';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

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
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FoodItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchFoodItems();
    
    // Check for category parameter in URL
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
    
    // Set up real-time subscription for food items
    const channel = supabase
      .channel('menu-food-items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_items'
        },
        (payload) => {
          console.log('Food item change detected in menu:', payload);
          fetchFoodItems();
          
          // Show toast for real-time updates
          if (payload.eventType === 'INSERT') {
            toast.success('New item added to menu!');
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Menu item updated!');
          } else if (payload.eventType === 'DELETE') {
            toast.info('Item removed from menu!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchParams]);

  useEffect(() => {
    filterItems();
  }, [foodItems, searchTerm, selectedCategory]);

  const fetchFoodItems = async () => {
    try {
      console.log('Fetching food items for menu...');
      const { data, error } = await supabase
        .from('food_items')
        .select('*, food_item_variants(id, label, price)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Menu food items fetch error:', error);
        throw error;
      }
      const items = (data || []).map(item => ({
        ...item,
        variants: item.food_item_variants || []
      }));
      setFoodItems(items);
      // Extract unique categories and add Snacks
      const uniqueCategories = Array.from(
        new Set(items.map(item => item.category).filter(Boolean))
      ) as string[];
      setCategories(['All', ...uniqueCategories, 'Snacks']);
    } catch (error) {
      console.error('Error fetching food items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = foodItems;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    setFilteredItems(filtered);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SocialIcons />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Our Menu</h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
            Explore our delicious collection of authentic Indian food, pickles, and snacks
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="max-w-md mx-auto">
            <Input
              type="text"
              placeholder="Search for food items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          
          {/* <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="text-xs sm:text-sm"
              >
                {category}
              </Button>
            ))}
          </div> */}
        </div>

        {/* Food Items Grid */}
        {selectedCategory === 'Snacks' ? (
          <ComingSoon 
            category="Snacks" 
            description="Delicious snacks and munchies are coming soon! Get ready for crispy, crunchy, and flavorful treats that will satisfy your cravings."
          />
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-lg animate-pulse">
                <div className="h-48 bg-gray-300 rounded-t-lg"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded mb-4"></div>
                  <div className="h-6 bg-gray-300 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredItems.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No items found matching your criteria.</p>
            {searchTerm && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                }}
                className="mt-4"
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
