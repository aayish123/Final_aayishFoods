
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, Menu, X, Heart, Tag, LogOut, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { supabase } from '@/integrations/supabase/client';
import SearchDialog from '@/components/common/SearchDialog';
import { useWishlist } from '@/shared/hooks/useWishlist';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const { totalItems } = useCart();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();

  const { data: wishlistData } = useWishlist(user?.id);
  const wishlistCount = wishlistData?.length || 0;

  const getInitials = () => {
    if (!user) return 'U';
    const fullName = user.user_metadata?.full_name;
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    return user.email?.slice(0, 2).toUpperCase() || 'US';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isAuthenticated = !!user;
  const isAdmin = role && role !== 'user';

  const handleAccountClick = () => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin' : '/dashboard');
    } else {
      openAuthModal();
    }
  };

  return (
    <header className="bg-background shadow-sm sticky top-0 z-50">
      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-border/40">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <Link to="/" className="flex flex-col items-center justify-center text-accent group">
            <span className="text-3xl md:text-4xl font-serif font-bold tracking-tight group-hover:opacity-90 transition-opacity">Aayish</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-3 h-[1px] bg-accent"></span>
              <span className="text-[9px] md:text-[10px] tracking-widest uppercase font-medium">Taste the Tradition</span>
              <span className="w-3 h-[1px] bg-accent"></span>
            </div>
          </Link>

          {/* Desktop Links */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link to="/" className="text-foreground hover:text-accent transition-colors font-serif text-lg">Home</Link>
            <Link to="/menu?category=Pickles" className="text-foreground hover:text-accent transition-colors font-serif text-lg">Pickles</Link>
            <Link to="/menu?category=Sweets" className="text-foreground hover:text-accent transition-colors font-serif text-lg">Sweets</Link>
            <Link to="/menu?category=Snacks" className="text-foreground hover:text-accent transition-colors font-serif text-lg">Snacks</Link>
            <Link to="/menu?category=Combos" className="text-foreground hover:text-accent transition-colors font-serif text-lg">Combos</Link>
            <Link to="/offers" className="text-foreground hover:text-accent transition-colors font-serif text-lg">Offers</Link>
            <Link to="/about" className="text-foreground hover:text-accent transition-colors font-serif text-lg">About Us</Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-8">
            <button onClick={() => setIsSearchOpen(true)} className="flex flex-col items-center text-foreground hover:text-accent transition-colors group">
              <Search className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Search</span>
            </button>
            
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center hover:opacity-90 transition-opacity focus:outline-none cursor-pointer">
                    <Avatar className="h-8 w-8 border border-accent/20 shadow-sm bg-[#1a3b2b] text-[#d4af37]">
                      <AvatarImage src={user?.user_metadata?.avatar_url || ''} />
                      <AvatarFallback className="bg-[#1a3b2b] text-[#d4af37] font-semibold text-xs flex items-center justify-center">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] font-medium mt-1 text-muted-foreground">Account</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-border/40 bg-white p-1">
                  <DropdownMenuItem 
                    onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')} 
                    className="hover:bg-accent/5 cursor-pointer font-serif py-2.5 px-3 flex items-center rounded-lg text-foreground font-medium"
                  >
                    <User className="h-4 w-4 mr-2.5 text-muted-foreground" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate('/reset-password')} 
                    className="hover:bg-accent/5 cursor-pointer font-serif py-2.5 px-3 flex items-center rounded-lg text-foreground font-medium"
                  >
                    <Key className="h-4 w-4 mr-2.5 text-muted-foreground" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut} 
                    className="text-red-600 hover:bg-red-50 cursor-pointer font-serif font-semibold py-2.5 px-3 flex items-center rounded-lg"
                  >
                    <LogOut className="h-4 w-4 mr-2.5" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button onClick={openAuthModal} className="flex flex-col items-center text-foreground hover:text-accent transition-colors group cursor-pointer">
                <User className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">Account</span>
              </button>
            )}

            <Link to="/wishlist" className="flex flex-col items-center text-foreground hover:text-accent transition-colors group relative">
              <div className="relative">
                <Heart className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-accent text-accent-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-in zoom-in duration-300">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">Wishlist</span>
            </Link>
            
            <Link to="/cart" className="flex flex-col items-center text-foreground hover:text-accent transition-colors group relative">
              <div className="relative">
                <ShoppingCart className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-3 bg-accent text-accent-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">Cart</span>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 text-foreground hover:bg-muted rounded-md transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-2 pb-4">
              <Link to="/" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>Home</Link>
              <Link to="/menu?category=Pickles" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>Pickles</Link>
              <Link to="/menu?category=Sweets" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>Sweets</Link>
              <Link to="/menu?category=Snacks" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>Snacks</Link>
              <Link to="/menu?category=Combos" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>Combos</Link>
              <Link to="/offers" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>Offers</Link>
              <Link to="/about" className="px-4 py-3 text-foreground font-serif hover:bg-muted hover:text-accent rounded-md" onClick={() => setIsMenuOpen(false)}>About Us</Link>
              
              <div className="grid grid-cols-4 gap-2 px-4 pt-4 border-t border-border mt-2">
                <button onClick={() => { setIsSearchOpen(true); setIsMenuOpen(false); }} className="flex flex-col items-center justify-center p-3 bg-muted rounded-lg text-foreground">
                  <Search className="h-5 w-5 mb-1" />
                  <span className="text-[10px]">Search</span>
                </button>
                <button onClick={() => { handleAccountClick(); setIsMenuOpen(false); }} className="flex flex-col items-center justify-center p-3 bg-muted rounded-lg text-foreground">
                  <User className="h-5 w-5 mb-1" />
                  <span className="text-[10px]">Account</span>
                </button>
                <Link to="/wishlist" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center justify-center p-3 bg-muted rounded-lg text-foreground relative">
                  <div className="relative">
                    <Heart className="h-5 w-5 mb-1" />
                    {wishlistCount > 0 && (
                      <span className="absolute -top-2 -right-3 bg-accent text-accent-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {wishlistCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px]">Wishlist</span>
                </Link>
                <Link to="/cart" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center justify-center p-3 bg-muted rounded-lg text-foreground relative">
                  <div className="relative">
                    <ShoppingCart className="h-5 w-5 mb-1" />
                    {totalItems > 0 && (
                      <span className="absolute -top-2 -right-3 bg-accent text-accent-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {totalItems}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px]">Cart</span>
                </Link>
              </div>

              {isAuthenticated && (
                <div className="px-4 pt-4">
                  <Button variant="outline" className="w-full text-accent border-accent hover:bg-accent hover:text-white" onClick={() => { handleSignOut(); setIsMenuOpen(false); }}>
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
};

export default Header;
