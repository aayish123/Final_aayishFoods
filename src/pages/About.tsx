import { Link } from 'react-router-dom';
import { Leaf, Heart, ShieldCheck, Truck, Users, ShoppingBag, CheckCircle2, ChevronRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

const About = () => {
  return (
    <div className="min-h-screen bg-[#FDF8F0] font-serif">
      <SEOHead
        title="About Us - AAYISH Foods"
        description="Learn about Aayish Foods, our heritage, and our promise to bring you authentic Indian pickles and sweets."
      />

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center text-xs text-muted-foreground border-b border-accent/10">
        <Link to="/" className="hover:text-accent transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-foreground">About Us</span>
      </div>

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24">
        {/* Decorative left pattern */}
        <div className="absolute left-0 top-20 w-32 h-64 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%235c2018\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
          
          {/* Left Text */}
          <div className="w-full lg:w-1/2 relative z-10">
            <h1 className="text-5xl md:text-6xl font-serif text-primary mb-6">About Aayish</h1>
            
            <h2 className="text-2xl md:text-3xl font-serif text-accent mb-6 leading-snug">
              Bringing the authentic flavors of <br className="hidden md:block"/>
              Andhra & Telangana to your home.
            </h2>
            
            <div className="space-y-4 text-muted-foreground text-lg mb-10 leading-relaxed max-w-lg">
              <p>
                At Aayish, we celebrate the rich culinary heritage of Andhra Pradesh and Telangana. From traditional pickles and homemade sweets to crispy snacks, every product is made with love, age-old recipes, and the finest ingredients.
              </p>
              <p>
                Our mission is simple – to deliver not just food, but memories of tradition, taste, and togetherness.
              </p>
            </div>

            {/* 4 Icons below text */}
            <div className="grid grid-cols-4 gap-4 max-w-lg">
              <div className="flex flex-col items-center text-center">
                <Leaf className="w-8 h-8 text-accent mb-3" strokeWidth={1.5} />
                <span className="text-[10px] sm:text-xs text-foreground font-medium leading-tight">100% Authentic<br/>Traditional Recipes</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Heart className="w-8 h-8 text-accent mb-3" strokeWidth={1.5} />
                <span className="text-[10px] sm:text-xs text-foreground font-medium leading-tight">Made in Small<br/>Batches</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <ShieldCheck className="w-8 h-8 text-accent mb-3" strokeWidth={1.5} />
                <span className="text-[10px] sm:text-xs text-foreground font-medium leading-tight">No Preservatives<br/>or Artificial Colors</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <CheckCircle2 className="w-8 h-8 text-accent mb-3" strokeWidth={1.5} />
                <span className="text-[10px] sm:text-xs text-foreground font-medium leading-tight">Made with Love<br/>in India</span>
              </div>
            </div>
          </div>

          {/* Right Image Placeholder */}
          <div className="w-full lg:w-1/2">
            <div className="w-full aspect-[4/3] relative rounded-3xl overflow-hidden border-4 border-accent/20 bg-accent/5 flex flex-col items-center justify-center p-8 text-center shadow-xl">
               <span className="z-10 bg-white/90 px-6 py-3 rounded-md text-accent font-serif text-lg border border-accent/20 shadow-sm mb-4">
                 [Replace with About Hero Image]
               </span>
               <p className="text-sm text-accent/80 font-medium">Attach the large jars image here.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Our Promise & Rooted in Tradition */}
      <section className="py-16 bg-[#Fdf6eb] relative border-t border-accent/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* Left: Our Promise */}
            <div className="w-full lg:w-[55%]">
              <div className="flex items-center justify-center gap-4 mb-10">
                <span className="text-accent">❖</span>
                <h2 className="text-3xl font-serif text-primary">Our Promise</h2>
                <span className="text-accent">❖</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex items-start gap-4">
                  <ShieldCheck className="w-10 h-10 text-accent shrink-0" strokeWidth={1} />
                  <div>
                    <h3 className="font-serif text-lg text-foreground font-semibold mb-1">Pure & Safe</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Hygienically prepared with the best quality ingredients.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Leaf className="w-10 h-10 text-accent shrink-0" strokeWidth={1} />
                  <div>
                    <h3 className="font-serif text-lg text-foreground font-semibold mb-1">Traditional Taste</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Bringing you the same home-style taste passed down for generations.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Heart className="w-10 h-10 text-accent shrink-0" strokeWidth={1} />
                  <div>
                    <h3 className="font-serif text-lg text-foreground font-semibold mb-1">Made with Care</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Every product is handcrafted in small batches with attention to detail.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Truck className="w-10 h-10 text-accent shrink-0" strokeWidth={1} />
                  <div>
                    <h3 className="font-serif text-lg text-foreground font-semibold mb-1">Delivered with Love</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Carefully packed and delivered fresh to your doorstep.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Rooted in Tradition Box */}
            <div className="w-full lg:w-[45%] relative">
               <div className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-10 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath fill=\'%235c2018\' d=\'M50 10 L80 40 L60 80 L30 70 Z\'/%3E%3C/svg%3E")' }}></div>
               <div className="bg-[#f5e9da] p-10 rounded-2xl border border-accent/20 h-full relative z-10 shadow-sm flex flex-col justify-center">
                  <h3 className="text-2xl md:text-3xl font-serif text-accent mb-4">Rooted in Tradition,<br/>Inspired by Culture</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    Our journey begins in the heart of Andhra & Telangana – a land known for its vibrant culture and irresistible cuisine.
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    We source locally, support small makers, and keep our traditions alive in every bite.
                  </p>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Quote and Stats Section */}
      <section className="py-16 bg-[#FDF8F0] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-[#f5e9da] rounded-xl border border-accent/20 p-8 md:p-12 shadow-sm flex flex-col lg:flex-row items-center gap-12">
            
            {/* Left Image Placeholder */}
            <div className="w-full lg:w-1/3 aspect-[16/9] relative rounded-xl overflow-hidden border-2 border-accent/20 bg-accent/5 flex flex-col items-center justify-center text-center">
              <span className="z-10 bg-white/90 px-4 py-2 rounded-md text-accent font-serif text-sm shadow-sm mb-2">
                 [Replace with Horizontal Image]
               </span>
               <p className="text-xs text-accent/80 font-medium">Attach second image here.</p>
            </div>

            {/* Right Quote and Stats */}
            <div className="w-full lg:w-2/3">
               <div className="relative mb-10">
                 <span className="absolute -top-6 -left-6 text-accent/30 text-7xl font-serif leading-none">“</span>
                 <h2 className="text-2xl md:text-3xl font-serif text-accent leading-snug relative z-10">
                   Food connects us to our roots, memories and to each other.
                 </h2>
                 <p className="mt-4 font-serif text-muted-foreground">– Team Aayish</p>
                 <span className="absolute -bottom-10 right-10 text-accent/30 text-7xl font-serif leading-none rotate-180">“</span>
               </div>

               <div className="grid grid-cols-3 gap-4 pt-8 border-t border-accent/20">
                 <div className="flex flex-col items-center text-center">
                   <Users className="w-8 h-8 text-primary mb-3" strokeWidth={1.5} />
                   <h4 className="text-xl font-bold font-serif text-foreground">10,000+</h4>
                   <p className="text-xs text-muted-foreground">Happy Customers</p>
                 </div>
                 <div className="flex flex-col items-center text-center border-l border-r border-accent/20">
                   <ShoppingBag className="w-8 h-8 text-primary mb-3" strokeWidth={1.5} />
                   <h4 className="text-xl font-bold font-serif text-foreground">150+</h4>
                   <p className="text-xs text-muted-foreground">Authentic Products</p>
                 </div>
                 <div className="flex flex-col items-center text-center">
                   <Heart className="w-8 h-8 text-primary mb-3" strokeWidth={1.5} />
                   <h4 className="text-xl font-bold font-serif text-foreground">50,000+</h4>
                   <p className="text-xs text-muted-foreground">Orders Delivered</p>
                 </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Features Strip (5 columns) */}
      <section className="bg-[#FDF8F0] py-8 border-y border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center justify-center space-x-3 border-r border-accent/10 last:border-0">
              <Leaf className="w-6 h-6 text-accent" strokeWidth={1.5} />
              <div>
                <p className="font-serif text-foreground text-sm font-semibold">100% Authentic</p>
                <p className="text-[10px] text-muted-foreground">Traditional Recipes</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-3 border-r border-accent/10 last:border-0">
              <ShieldCheck className="w-6 h-6 text-accent" strokeWidth={1.5} />
              <div>
                <p className="font-serif text-foreground text-sm font-semibold">No Preservatives</p>
                <p className="text-[10px] text-muted-foreground">Made with Natural Ingredients</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-3 border-r border-accent/10 last:border-0">
              <Heart className="w-6 h-6 text-accent" strokeWidth={1.5} />
              <div>
                <p className="font-serif text-foreground text-sm font-semibold">Made in Small Batches</p>
                <p className="text-[10px] text-muted-foreground">For Great Taste</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center space-x-3 border-r border-accent/10 last:border-0">
              <CheckCircle2 className="w-6 h-6 text-accent" strokeWidth={1.5} />
              <div>
                <p className="font-serif text-foreground text-sm font-semibold">Secure Packaging</p>
                <p className="text-[10px] text-muted-foreground">Ensuring Freshness</p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-3 last:border-0">
              <Truck className="w-6 h-6 text-accent" strokeWidth={1.5} />
              <div>
                <p className="font-serif text-foreground text-sm font-semibold">Pan India Delivery</p>
                <p className="text-[10px] text-muted-foreground">Quick & Reliable</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default About;
