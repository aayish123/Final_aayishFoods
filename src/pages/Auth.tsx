
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
          const err = error as any;
          if (err.message.includes('Email not confirmed')) {
            toast.error('Please check your email and click the confirmation link first.');
          } else if (err.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please check your credentials.');
          } else {
            toast.error(err.message);
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
          const err = error as any;
          if (err.message.includes('User already registered')) {
            toast.error('Account already exists. Please sign in instead.');
            setIsLogin(true);
          } else {
            toast.error(err.message);
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
        toast.error((error as any).message);
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
      if (role && role !== 'user') {
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border border-border/40 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-10 pb-6 px-8">
            <Link to="/" className="inline-block mb-6">
              <span className="text-3xl font-serif font-bold text-primary tracking-tight">AAYISH</span>
            </Link>
            <CardTitle className="font-serif text-3xl font-bold text-foreground mb-2">Forgot Password</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-14 pl-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all" disabled={forgotPasswordLoading}>
                {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
            
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={goBackToLogin}
                className="inline-flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border border-border/40 rounded-3xl overflow-hidden">
        <CardHeader className="text-center pt-10 pb-6 px-8">
          <Link to="/" className="inline-block mb-6">
            <span className="text-3xl font-serif font-bold text-primary tracking-tight">AAYISH</span>
          </Link>
          <CardTitle className="font-serif text-3xl font-bold text-foreground mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {isLogin 
              ? 'Sign in to your account to continue' 
              : 'Join AAYISH for delicious food delivery'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="h-14 pl-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 pl-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-14 pl-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                />
              </div>
            </div>
            
            {/* Forgot Password Link - Only show on login */}
            {isLogin && (
              <div className="text-right pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            )}
            
            <div className="pt-2">
              <Button type="submit" className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all" disabled={loading}>
                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
              </Button>
            </div>
            
            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-semibold">
                <span className="bg-background px-4 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full h-14 rounded-xl text-base font-semibold border-2 hover:bg-secondary/20 transition-all"
            >
              {googleLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground mr-3" />
              ) : (
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
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
          
          <div className="mt-8 text-center">
            <p className="text-base text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-primary hover:text-primary/80 font-bold transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
