
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Clock, Truck, CheckCircle } from 'lucide-react';
import SocialIcons from '@/components/SocialIcons';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      openAuthModal();
    }
  }, [user, loading, openAuthModal]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SocialIcons />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.user_metadata?.full_name || 'Food Lover'}!
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your orders and explore delicious food options
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/menu')}
          >
            <CardContent className="p-6 text-center">
              <ShoppingBag className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Browse Menu</h3>
              <p className="text-gray-600 text-sm">Explore our delicious food items</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/cart')}
          >
            <CardContent className="p-6 text-center">
              <Clock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">View Cart</h3>
              <p className="text-gray-600 text-sm">Check your current order</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/orders')}
          >
            <CardContent className="p-6 text-center">
              <Truck className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Track Orders</h3>
              <p className="text-gray-600 text-sm">Monitor your order status</p>
            </CardContent>
          </Card>

          {/* <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/profile')}
          >
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Profile</h3>
              <p className="text-gray-600 text-sm">Manage your account</p>
            </CardContent>
          </Card> */}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity to show.</p>
              <Button 
                className="mt-4"
                onClick={() => navigate('/menu')}
              >
                Start Ordering
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
