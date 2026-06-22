import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Heart, ShieldCheck, Truck, Headphones, BadgeCheck, CheckCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEOHead from '@/components/SEOHead';
import FoodCard from '@/components/FoodCard';
import FAQ from '@/components/FAQ';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import landingHero from '@/assets/landing_hero.webp';
import { getOptimizedImageUrl } from '@/lib/utils';

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

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number | null;
}

interface Category {
  id: string;
  name: string;
  image_url: string | null;
  display_order: number | null;
}

interface TrustBadge {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  id: string;
  author: string;
  role: string;
  comment: string;
  rating: number;
}

interface CMSContent {
  hero: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    bgImageUrl: string;
  };
  about: {
    title: string;
    description: string;
    features: string[];
    imageUrl: string;
  };
  testimonials: {
    title: string;
    list: Testimonial[];
  };
  trust_badges: {
    title: string;
    list: TrustBadge[];
  };
}

interface CmsSectionRecord {
  id: string;
  published_content: Record<string, unknown> | null;
}

const Landing = () => {
  const [featuredItems, setFeaturedItems] = useState<FoodItem[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();

  const [cmsContent, setCmsContent] = useState<CMSContent>({
    hero: {
      title: 'The Authentic Taste of Andhra & Telangana',
      subtitle: 'Traditional Recipes. Premium Ingredients. Made with Love.',
      ctaText: 'Shop Now',
      ctaLink: '/menu',
      bgImageUrl: ''
    },
    about: {
      title: 'Rooted in Tradition, Delivered with Love',
      description: 'At Aayish, every product is a celebration of our rich culinary heritage. From timeless family recipes to carefully sourced ingredients, we bring you the true taste of Andhra & Telangana—just like it\'s made at home.',
      features: [
        'Authentic Recipes (Passed down through generations)',
        'Premium Ingredients (Sourced with care and purity)',
        'Made In Small Batches (For maximum freshness & taste)'
      ],
      imageUrl: ''
    },
    testimonials: {
      title: 'What Our Customers Say',
      list: [
        { id: '1', author: 'Pranathi R.', role: 'Hyderabad', comment: 'The avakaya pickle is just like my grandmother used to make. Absolutely authentic and delicious!', rating: 5 },
        { id: '2', author: 'Suresh K.', role: 'Vijayawada', comment: 'Putharekulu was packed so well and tasted amazing. You can truly feel the quality and care in every bite.', rating: 5 },
        { id: '3', author: 'Anusha M.', role: 'Bangalore', comment: 'Great packaging, fast delivery and superb taste. Aayish is now my go-to for all traditional cravings!', rating: 5 }
      ]
    },
    trust_badges: {
      title: 'Why Choose Aayish?',
      list: [
        { id: '1', icon: 'Truck', title: 'Pan India Delivery', description: 'Delivering Happiness' },
        { id: '2', icon: 'Leaf', title: 'Freshly Made', description: 'Small Batches' },
        { id: '3', icon: 'ShieldCheck', title: 'Secure Packaging', description: 'Safe & Hygienic' },
        { id: '4', icon: 'Headphones', title: 'Customer Support', description: 'We\'re Here to Help' }
      ]
    }
  });

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      await Promise.all([
        fetchFeaturedItems(),
        fetchCmsContent(),
        fetchBannersAndCategories()
      ]);
      setLoading(false);
    };

    initializePage();
  }, []);

  const fetchFeaturedItems = async () => {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('*, food_item_variants(id, label, price)')
        .eq('status', 'published')
        .eq('in_stock', true)
        .limit(4);

      if (error) throw error;
      const items = (data || []).map(item => ({
        ...item,
        variants: item.food_item_variants || []
      }));
      setFeaturedItems(items);
    } catch (error) {
      console.error('Error fetching featured items:', error);
    }
  };

  const fetchCmsContent = async () => {
    try {
      const { data, error } = await supabase
        .from('cms_sections')
        .select('*');
      if (error) throw error;

      if (data && data.length > 0) {
        const mergedContent = { ...cmsContent };
        (data as unknown as CmsSectionRecord[]).forEach((section) => {
          if (section.published_content) {
            mergedContent[section.id] = section.published_content;
          }
        });
        setCmsContent(mergedContent);
      }
    } catch (error) {
      console.error('Error fetching CMS content:', error);
    }
  };

  const fetchBannersAndCategories = async () => {
    try {
      // Fetch Banners
      const { data: bannerData } = await supabase
        .from('banners')
        .select('*')
        .eq('page', 'home')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (bannerData) setBanners(bannerData);

      // Fetch Categories
      const { data: categoryData } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (categoryData) setDbCategories(categoryData);
    } catch (error) {
      console.error('Error fetching banners or categories:', error);
    }
  };

  const getTrustIcon = (iconName: string) => {
    switch (iconName) {
      case 'Truck': return <Truck className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
      case 'Leaf': return <Leaf className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
      case 'ShieldCheck': return <ShieldCheck className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
      case 'Headphones': return <Headphones className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
      case 'Award': return <BadgeCheck className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
      case 'Heart': return <Heart className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
      default: return <Leaf className="w-8 h-8 text-foreground" strokeWidth={1.5} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="AAYISH Foods - Authentic Indian Pickles, Chicken Curry & Traditional Delicacies Online"
        description="Order authentic Indian food online! Fresh chicken curry, mango pickle, gongura pickle, tomato pickle, and traditional Indian delicacies."
        keywords="Indian food delivery, authentic Indian cuisine, food delivery, traditional Indian food"
        url="https://www.aayishfoods.online/"
      />
      
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-[#e9dbbe] flex items-center w-full py-8 md:py-12 lg:py-16">
        {/* Full width background image (using object-contain to prevent ANY cutting, while keeping height reasonable) */}
        <div className="absolute inset-0 z-0 flex justify-end overflow-hidden pointer-events-none">
          <img 
            src={cmsContent.hero.bgImageUrl ? getOptimizedImageUrl(cmsContent.hero.bgImageUrl) : landingHero} 
            alt="Authentic Flavors of Andhra & Telangana" 
            className="h-full w-auto max-w-none object-contain object-right" 
            loading="eager"
          />
        </div>
        {/* Optional overlay gradient to ensure text readability and seamless blend on the left */}
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#e9dbbe] via-[#e9dbbe]/90 to-transparent w-[70%] lg:w-[60%]"></div>

        {/* Left Text Column - Adjusted width to prevent overlapping jars */}
        <div className="relative z-10 w-full">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="w-full lg:w-[45%] pr-0 lg:pr-8 text-center lg:text-left">
              <h2 className="text-base md:text-lg lg:text-xl font-serif text-primary mb-1 drop-shadow-sm">Bringing Home</h2>
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-[1.15] font-serif text-primary mb-3 drop-shadow-sm">
                {cmsContent.hero.title}
              </h1>
              <p className="text-sm md:text-base lg:text-lg font-serif text-accent mb-4 lg:mb-6 max-w-md mx-auto lg:mx-0 drop-shadow-sm">
                {cmsContent.hero.subtitle}
              </p>

              {/* Feature Icons Grid */}
              <div className="grid grid-cols-4 gap-2 mb-8 max-w-lg mx-auto lg:mx-0">
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full border border-accent/40 bg-white/50 backdrop-blur-sm flex items-center justify-center mb-2 shadow-sm">
                    <Leaf className="w-5 h-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-serif text-foreground font-semibold drop-shadow-sm leading-tight">100%<br/>Authentic</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full border border-accent/40 bg-white/50 backdrop-blur-sm flex items-center justify-center mb-2 shadow-sm">
                    <BadgeCheck className="w-5 h-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-serif text-foreground font-semibold drop-shadow-sm leading-tight">Traditional<br/>Recipes</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full border border-accent/40 bg-white/50 backdrop-blur-sm flex items-center justify-center mb-2 shadow-sm">
                    <CheckCircle className="w-5 h-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-serif text-foreground font-semibold drop-shadow-sm leading-tight">Natural<br/>Ingredients</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full border border-accent/40 bg-white/50 backdrop-blur-sm flex items-center justify-center mb-2 shadow-sm">
                    <Heart className="w-5 h-5 text-accent" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-serif text-foreground font-semibold drop-shadow-sm leading-tight">Made with<br/>Love</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start items-center">
                <Link to={cmsContent.hero.ctaLink || '/menu'}>
                  <Button className="bg-primary hover:bg-primary/90 text-white font-medium tracking-widest text-sm px-10 h-14 rounded-none uppercase shadow-md">
                    {cmsContent.hero.ctaText || 'Shop Now'} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/menu" className="font-medium tracking-widest text-sm text-foreground hover:text-accent uppercase flex items-center transition-colors drop-shadow-sm">
                  Explore Collection <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Shop by Category Section (Dark Green) */}
      <section className="bg-primary py-16 relative border-b-4 border-[#cda274]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-4 mb-14">
            <span className="text-[#cda274]">❖</span>
            <h2 className="text-3xl md:text-4xl font-serif text-white">Shop by Category</h2>
            <span className="text-[#cda274]">❖</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {dbCategories.length > 0 ? (
              dbCategories.map((category) => (
                <Link key={category.id} to={`/menu?category=${category.name}`} className="flex flex-col items-center group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#cda274] overflow-hidden mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src={category.image_url ? getOptimizedImageUrl(category.image_url) : 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?q=80&w=400&auto=format&fit=crop'} alt={category.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="font-serif text-xl text-white mb-1">{category.name}</h3>
                  <p className="text-xs text-[#cda274] font-medium tracking-wide">❖ Traditional Taste ❖</p>
                </Link>
              ))
            ) : (
              <>
                <Link to="/menu?category=Pickles" className="flex flex-col items-center group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#cda274] overflow-hidden mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src="https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?q=80&w=400&auto=format&fit=crop" alt="Pickles" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="font-serif text-xl text-white mb-1">Pickles</h3>
                  <p className="text-xs text-[#cda274] font-medium tracking-wide">❖ Traditional & Spicy ❖</p>
                </Link>

                <Link to="/menu?category=Sweets" className="flex flex-col items-center group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#cda274] overflow-hidden mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src="https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?q=80&w=400&auto=format&fit=crop" alt="Sweets" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="font-serif text-xl text-white mb-1">Sweets</h3>
                  <p className="text-xs text-[#cda274] font-medium tracking-wide">❖ Homemade Goodness ❖</p>
                </Link>

                <Link to="/menu?category=Snacks" className="flex flex-col items-center group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#cda274] overflow-hidden mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src="https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=400&auto=format&fit=crop" alt="Snacks" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="font-serif text-xl text-white mb-1">Snacks</h3>
                  <p className="text-xs text-[#cda274] font-medium tracking-wide">❖ Crispy & Flavorful ❖</p>
                </Link>

                <Link to="/menu?category=Gift Boxes" className="flex flex-col items-center group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#cda274] overflow-hidden mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=400&auto=format&fit=crop" alt="Gift Boxes" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="font-serif text-xl text-white mb-1">Gift Boxes</h3>
                  <p className="text-xs text-[#cda274] font-medium tracking-wide">❖ Perfect for Every Occasion ❖</p>
                </Link>

                <Link to="/menu?category=Combos" className="flex flex-col items-center group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#cda274] overflow-hidden mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300">
                    <img src="https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80&w=400&auto=format&fit=crop" alt="Combos" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="font-serif text-xl text-white mb-1">Combos</h3>
                  <p className="text-xs text-[#cda274] font-medium tracking-wide">❖ Handpicked for You ❖</p>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Dynamic Promo Banners Section */}
      {banners.length > 0 && (
        <section className="bg-[#FDF8F0] py-10 border-b border-border/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {banners.map((banner) => (
                <a key={banner.id} href={banner.link_url || '#'} className="block overflow-hidden border border-border/40 hover:shadow-lg transition-all rounded-lg">
                  <img src={getOptimizedImageUrl(banner.image_url)} alt={banner.title} className="w-full h-auto object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Features Strip */}
      <section className="bg-[#FDF8F0] py-6 border-b border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cmsContent.trust_badges.list?.map((badge: TrustBadge, i: number) => (
              <div key={badge.id || i} className="flex items-center justify-center space-x-4 border-r border-accent/10 last:border-0">
                {getTrustIcon(badge.icon)}
                <div>
                  <p className="font-serif text-foreground font-semibold">{badge.title}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative Border Strip */}
      <div className="h-4 w-full bg-[#FDF8F0] bg-repeat-x opacity-30" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%235c2018\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }}></div>

      {/* 4. Best Sellers Section */}
      <section className="bg-[#FDF8F0] py-20 border-b border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-accent">❖</span>
              <h2 className="text-4xl md:text-5xl font-serif text-primary">Best Sellers</h2>
              <span className="text-accent">❖</span>
            </div>
            <p className="text-muted-foreground font-serif text-lg">Loved by thousands of happy customers</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-96 bg-accent/5 rounded-none border border-accent/10 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredItems.map((item) => (
                <FoodCard key={item.id} item={item} />
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link to="/menu">
              <Button variant="outline" className="rounded-none border-accent text-accent hover:bg-accent hover:text-white px-10 h-12 tracking-widest font-medium">
                VIEW ALL PRODUCTS
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Our Heritage Section */}
      <section className="bg-[#FDF8F0] flex flex-col md:flex-row border-b border-border/20 overflow-hidden">
        {/* Left Image Placeholder */}
        <div className="w-full md:w-1/2 relative min-h-[500px] border-r-4 border-accent/20 flex flex-col items-center justify-center text-center p-8 bg-accent/5">
          {cmsContent.about.imageUrl ? (
            <img src={getOptimizedImageUrl(cmsContent.about.imageUrl)} alt={cmsContent.about.title} className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-500" loading="lazy" />
          ) : (
            <>
              <span className="z-10 bg-white/90 px-6 py-3 rounded-md text-accent font-serif text-lg border border-accent/20 shadow-xl mb-4">
                [Replace with Charminar / Heritage Image]
              </span>
              <p className="text-sm text-accent/80 font-medium">Attach left-side image here.</p>
            </>
          )}
        </div>

        {/* Right Text */}
        <div className="w-full md:w-1/2 p-12 md:p-20 flex flex-col justify-center relative">
          {/* Subtle ornate background */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%235c2018\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
          
          <div className="relative z-10">
            <p className="text-accent font-serif font-medium tracking-widest text-sm mb-4">Our Heritage, Our Promise.</p>
            <h2 className="text-4xl md:text-5xl font-serif text-primary mb-6 leading-tight">
              {cmsContent.about.title}
            </h2>
            <p className="text-muted-foreground font-serif text-lg mb-10 leading-relaxed max-w-lg">
              {cmsContent.about.description}
            </p>
            
            <div className="space-y-6">
              {cmsContent.about.features?.map((feature: string, i: number) => {
                const parts = feature.split('(');
                const title = parts[0]?.trim();
                const desc = parts[1] ? parts[1].replace(')', '').trim() : '';
                return (
                  <div key={i} className="flex items-start">
                    <div className="p-2 border border-accent rounded-full mr-4 text-accent">
                      {i === 0 ? <CheckCircle className="w-6 h-6" /> : i === 1 ? <Leaf className="w-6 h-6" /> : <Heart className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-foreground">{title}</h4>
                      {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Testimonials Section */}
      <section className="bg-[#FDF8F0] py-20 pb-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-[#cda274]">❖</span>
              <h2 className="text-4xl font-serif text-primary">{cmsContent.testimonials.title || 'What Our Customers Say'}</h2>
              <span className="text-[#cda274]">❖</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cmsContent.testimonials.list?.map((t: Testimonial, i: number) => (
              <div key={t.id || i} className="bg-[#f5e9da] p-8 border border-[#e5d4c0] relative mt-6 rounded-sm shadow-sm">
                <div className="absolute -top-6 left-6 text-[#cda274] text-7xl font-serif leading-none">“</div>
                <div className="flex justify-center mb-4 pt-4">
                  {[...Array(t.rating || 5)].map((_, idx) => <Star key={idx} className="w-4 h-4 fill-[#cda274] text-[#cda274] mx-0.5" />)}
                </div>
                <p className="text-center text-foreground font-serif italic mb-8 px-4">"{t.comment}"</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-accent/10">
                     <span className="text-accent font-serif font-bold text-lg">{t.author ? t.author[0] : 'U'}</span>
                  </div>
                  <div>
                    <p className="font-serif font-bold text-sm text-foreground">{t.author}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
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
