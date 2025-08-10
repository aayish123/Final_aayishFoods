
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, role, user, loading: authLoading } = useAuth();
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const navigate = useNavigate();

  // Admin credentials
  const ADMIN_EMAIL = 'aayishfoods@gmail.com';
  const ADMIN_PASSWORD = 'Thinkcheddam';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            toast.error('Please check your email and click the confirmation link first.');
          } else if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please check your credentials.');
          } else {
            toast.error(error.message);
          }
        } else {
          setPendingRedirect(true); // Wait for role to be loaded
        }
      } else {
        if (!fullName.trim()) {
          toast.error('Please enter your full name');
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Account already exists. Please sign in instead.');
            setIsLogin(true);
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created successfully! You can now sign in.');
          setIsLogin(true);
          setPassword('');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Redirect after login when role is loaded
  useEffect(() => {
    if (pendingRedirect && user && role) {
      if (role === 'admin') {
        toast.success('Welcome Admin!');
        navigate('/admin');
      } else {
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
      setPendingRedirect(false);
    }
  }, [pendingRedirect, user, role, navigate]);

  // Show loading spinner while waiting for role after login
  if (pendingRedirect && (!role || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="text-2xl font-bold text-orange-600 mb-4 block">
            AAYISH
          </Link>
          <CardTitle>{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Sign in to your account to continue' 
              : 'Join AAYISH for delicious food delivery'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 text-orange-600 hover:underline font-medium"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* {isLogin && (
            <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-semibold text-orange-800 mb-2">Demo Admin Access:</p>
              <p className="text-sm text-orange-700"><strong>Email:</strong> aayishfoods@gmail.com</p>
              <p className="text-sm text-orange-700"><strong>Password:</strong> Thinkcheddam</p>
            </div>
          )} */}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
