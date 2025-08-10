
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useAuthModal } from '@/contexts/AuthModalContext';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const { totalItems } = useCart();
  const { isAuthModalOpen, openAuthModal, closeAuthModal } = useAuthModal();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;
  const isAdmin = role === 'admin';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-orange-600">AAYISH</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-orange-600 transition-colors">
              Home
            </Link>
            <Link to="/menu" className="text-gray-700 hover:text-orange-600 transition-colors">
              Menu
            </Link>
            {/* <Link to="/menu?category=Snacks" className="text-gray-700 hover:text-orange-600 transition-colors">
              Snacks
            </Link> */}
            {isAuthenticated && !isAdmin && (
              <Link to="/orders" className="text-gray-700 hover:text-orange-600 transition-colors">
                Track Orders
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {user && !isAdmin && (
              <Link to="/cart" className="relative">
                <ShoppingCart className="h-6 w-6 text-gray-700 hover:text-orange-600 transition-colors" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Link>
            )}
            
            <div className="hidden md:flex items-center space-x-2">
              {isAuthenticated ? (
                <div className="flex items-center space-x-2">
                  {isAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/admin')}
                      className="flex items-center space-x-1"
                    >
                      <User className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/dashboard')}
                      className="flex items-center space-x-1"
                    >
                      <User className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Button>
                  )}
                  {!isAdmin && (
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      Logout
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={openAuthModal} size="sm">
                  Sign In
                </Button>
              )}
            </div>

            <button
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <Link
                to="/"
                className="text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/menu"
                className="text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Menu
              </Link>
              <Link
                to="/menu?category=Snacks"
                className="text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Snacks
              </Link>
              {isAuthenticated && !isAdmin && (
                <Link
                  to="/orders"
                  className="text-gray-700 hover:text-orange-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Track Orders
                </Link>
              )}
              {isAuthenticated ? (
                <div className="flex flex-col space-y-2">
                  {isAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigate('/admin');
                        setIsMenuOpen(false);
                      }}
                    >
                      Admin Panel
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigate('/dashboard');
                        setIsMenuOpen(false);
                      }}
                    >
                      Dashboard
                    </Button>
                  )}
                  {!isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSignOut();
                        setIsMenuOpen(false);
                      }}
                    >
                      Sign Out
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSignOut();
                        setIsMenuOpen(false);
                      }}
                    >
                      Logout
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => {
                    openAuthModal();
                    setIsMenuOpen(false);
                  }}
                  size="sm"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
