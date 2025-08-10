
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Truck, Shield, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FoodCard from '@/components/FoodCard';
import SocialIcons from '@/components/SocialIcons';
import { supabase } from '@/integrations/supabase/client';
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
  price: number;
  image_url: string | null;
  category: string | null;
  in_stock: boolean | null;
  variants: FoodItemVariant[];
}

const Landing = () => {
  const [featuredItems, setFeaturedItems] = useState<FoodItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { openAuthModal, openPasswordResetModal } = useAuthModal();
  const navigate = useNavigate();

  // Landing page no longer handles password recovery - it's handled by /reset-password route

  useEffect(() => {
    fetchFeaturedItems();
  }, []);

  const fetchFeaturedItems = async () => {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('*, food_item_variants(id, label, price)')
        .eq('in_stock', true)
        .limit(6);

      if (error) throw error;
      const items = (data || []).map(item => ({
        ...item,
        variants: item.food_item_variants || []
      }));
      setFeaturedItems(items);
    } catch (error) {
      console.error('Error fetching featured items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackOrder = () => {
    if (user) {
      navigate('/orders');
    } else {
      openAuthModal();
    }
  };

  const filteredItems = featuredItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <SocialIcons />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 min-h-[70vh] flex items-center">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
            Welcome to <span className="text-yellow-300">AAYISH</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
            Authentic Indian food delivered fresh to your doorstep. Perfect for hostel students, working professionals, and food lovers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/menu">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                Order Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button 
              size="lg" 
             
              className="border-white bg-white text-orange-600  hover:bg-gray-100"
              onClick={handleTrackOrder}
            >
              Track Order
            </Button>
          </div>
        </div>
      </section>



      {/* Featured Items Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Featured Items
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Discover our most popular dishes loved by students and professionals
            </p>
          </div>

          <div className="mb-8 max-w-md mx-auto">
            <Input
              type="text"
              placeholder="Search for food items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <FoodCard key={item.id} item={item} />
              ))}
            </div>
          )}

          <div className="text-center mt-8">
            <Link to="/menu">
              <Button size="lg">
                View Full Menu <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

            {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose AAYISH?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg bg-white shadow-lg">
              <Clock className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Fast Delivery</h3>
              <p className="text-gray-600">Quick delivery within 2-3 days to your location.</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-white shadow-lg">
              <Shield className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Quality Food</h3>
              <p className="text-gray-600">Fresh, authentic Indian food made with love and care.</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-white shadow-lg">
              <Truck className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-gray-600">Track your order from kitchen to your doorstep.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            What Our Customers Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Priya S.",
                role: "Hostel Student",
                text: "Amazing food quality and super fast delivery! Perfect for late-night cravings.",
                rating: 5
              },
              {
                name: "Rajesh K.",
                role: "Working Professional",
                text: "The authentic taste reminds me of home. AAYISH has become my go-to for lunch.",
                rating: 5
              },
              {
                name: "Meera D.",
                role: "Housewife",
                text: "Great variety of pickles and snacks. My family loves the traditional flavors.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">"{testimonial.text}"</p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
