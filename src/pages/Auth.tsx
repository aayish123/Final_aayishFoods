
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Mail, User, Lock, ArrowLeft } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, role, user, loading: authLoading, signInWithGoogle, resetPassword } = useAuth();
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error('Google sign-in failed. Please try again.');
      }
      // Google OAuth will redirect, so we don't need to handle success here
    } catch (error) {
      toast.error('An unexpected error occurred during Google sign-in');
      console.error('Google sign-in error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset link sent to your email! Check your inbox.');
        setShowForgotPassword(false);
        setEmail('');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Forgot password error:', error);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const goBackToLogin = () => {
    setShowForgotPassword(false);
    setEmail('');
    setPassword('');
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

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link to="/" className="text-2xl font-bold text-orange-600 mb-4 block">
              AAYISH
            </Link>
            <CardTitle>Forgot Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={forgotPasswordLoading}>
                {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={goBackToLogin}
                className="flex items-center justify-center w-full text-sm text-gray-600 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
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
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="pl-10"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Forgot Password Link - Only show on login */}
            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-orange-600 hover:text-orange-700 hover:underline transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
            
            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>
            
            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full"
            >
              {googleLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
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
