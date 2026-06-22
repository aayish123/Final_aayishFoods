import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full">
      {/* Newsletter Section - Maroon */}
      <div className="bg-accent py-10 border-b border-accent-foreground/10 relative overflow-hidden">
         {/* Decorative pattern on the right */}
        <div className="absolute right-0 top-0 h-full w-1/4 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between">
          <div className="text-white mb-6 md:mb-0">
            <h3 className="font-serif text-2xl font-semibold mb-1">Stay Connected with Aayish</h3>
            <p className="text-white/80 text-sm">Be the first to know about new products, offers & more!</p>
          </div>
          <form className="flex w-full md:w-auto" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="px-4 py-3 min-w-[250px] text-foreground bg-[#FDF8F0] focus:outline-none"
              required
            />
            <button type="submit" className="bg-[#4a1a13] text-white px-8 py-3 font-medium tracking-wide border-l border-white/20 hover:bg-[#3a140f] transition-colors uppercase text-sm">
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Main Footer Content - Dark Green */}
      <div className="bg-primary text-white pt-16 pb-8 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          
          {/* Column 1: Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex flex-col text-white group mb-4">
              <span className="text-4xl font-serif font-bold tracking-tight">Aayish</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="w-3 h-[1px] bg-white/60"></span>
                <span className="text-[9px] tracking-widest uppercase font-medium text-white/80">Taste the Tradition</span>
                <span className="w-3 h-[1px] bg-white/60"></span>
              </div>
            </Link>
            <p className="text-white/70 text-xs leading-relaxed mb-6">
              Bringing the authentic flavors of Andhra & Telangana to your home. Made with love. Delivered with care.
            </p>
            {/* Social Icons Placeholder */}
            <div className="flex space-x-3">
               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer transition-colors">
                  <span className="text-xs">FB</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer transition-colors">
                  <span className="text-xs">IG</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 cursor-pointer transition-colors">
                  <span className="text-xs">TW</span>
               </div>
            </div>
          </div>

          {/* Column 2: Shop */}
          <div>
            <h4 className="font-serif font-semibold mb-4 text-[#FDF8F0]">Shop</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link to="/menu?category=Pickles" className="hover:text-white transition-colors">Pickles</Link></li>
              <li><Link to="/menu?category=Sweets" className="hover:text-white transition-colors">Sweets</Link></li>
              <li><Link to="/menu?category=Snacks" className="hover:text-white transition-colors">Snacks</Link></li>
              <li><Link to="/menu?category=Combos" className="hover:text-white transition-colors">Combos</Link></li>
              <li><Link to="/menu?category=Gift Boxes" className="hover:text-white transition-colors">Gift Boxes</Link></li>
              <li><Link to="/menu" className="hover:text-white transition-colors">All Products</Link></li>
            </ul>
          </div>

          {/* Column 3: Help & Support */}
          <div>
            <h4 className="font-serif font-semibold mb-4 text-[#FDF8F0]">Help & Support</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/shipping" className="hover:text-white transition-colors">Shipping & Delivery</Link></li>
              <li><Link to="/returns" className="hover:text-white transition-colors">Returns & Refunds</Link></li>
              <li><Link to="/faqs" className="hover:text-white transition-colors">FAQs</Link></li>
              <li><Link to="/orders" className="hover:text-white transition-colors">Track Order</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Column 4: Policies */}
          <div>
            <h4 className="font-serif font-semibold mb-4 text-[#FDF8F0]">Policies</h4>
            <ul className="space-y-2 text-xs text-white/70">
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/cancellation" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
            </ul>
          </div>

          {/* Column 5: Contact Us */}
          <div>
            <h4 className="font-serif font-semibold mb-4 text-[#FDF8F0]">Contact Us</h4>
            <ul className="space-y-4 text-xs text-white/70">
              <li className="flex items-start">
                <Phone className="w-4 h-4 mr-3 shrink-0 text-[#cda274]" />
                <span>+91 91234 56789</span>
              </li>
              <li className="flex items-start">
                <Mail className="w-4 h-4 mr-3 shrink-0 text-[#cda274]" />
                <span>hello@aayish.in</span>
              </li>
              <li className="flex items-start">
                <MapPin className="w-4 h-4 mr-3 shrink-0 text-[#cda274]" />
                <span>Hyderabad, Telangana, India</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-[10px] text-white/50">
          <p>© {new Date().getFullYear()} Aayish. All Rights Reserved.</p>
          <p className="my-2 md:my-0">Made with <span className="text-red-500">❤️</span> in India</p>
          <div className="flex items-center space-x-2">
            {/* Payment method placeholders */}
            <div className="px-2 py-1 bg-white rounded text-[#1a3b2b] font-bold">UPI</div>
            <div className="px-2 py-1 bg-white rounded text-[#1a3b2b] font-bold">VISA</div>
            <div className="px-2 py-1 bg-white rounded text-[#1a3b2b] font-bold">MC</div>
            <div className="px-2 py-1 bg-white rounded text-[#1a3b2b] font-bold">Rupay</div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
