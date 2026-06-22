import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { toast } from 'sonner';
import { Mail, Lock } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot';

const AuthModal = () => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp, resetPassword, signInWithGoogle, role, user } = useAuth();
  const { isAuthModalOpen, closeAuthModal, setGoogleOAuthInProgress } = useAuthModal();
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const navigate = useNavigate();

  // Reset OAuth progress state when user is authenticated
  useEffect(() => {
    if (user && setGoogleOAuthInProgress) {
      setGoogleOAuthInProgress(false);
    }
  }, [user, setGoogleOAuthInProgress]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleOAuthInProgress(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error('Google sign-in failed. Please try again.');
        setGoogleLoading(false);
        setGoogleOAuthInProgress(false);
      } else {
        toast.success('Redirecting to Google...');
        // Close modal immediately when Google OAuth redirect starts
        closeAuthModal();
        // Set a timeout to reset OAuth state in case redirect fails
        setTimeout(() => {
          setGoogleOAuthInProgress(false);
        }, 30000); // 30 seconds timeout
        // Google OAuth will redirect, so we don't need to handle success here
      }
    } catch (error) {
      toast.error('An unexpected error occurred during Google sign-in');
      console.error('Google sign-in error:', error);
      setGoogleLoading(false);
      setGoogleOAuthInProgress(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signin') {
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
          setPendingRedirect(true);
        }
      } else if (mode === 'signup') {
        if (!fullName.trim()) {
          toast.error('Please enter your full name');
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Account already exists. Please sign in instead.');
            setMode('signin');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created successfully! You can now sign in.');
          setMode('signin');
          setPassword('');
        }
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          toast.error('Please enter your email address');
          return;
        }
        const { error } = await resetPassword(email);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Password reset link sent to your email!');
          setMode('signin');
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
  if (pendingRedirect && user && role) {
    if (role && role !== 'user') {
      toast.success('Welcome Admin!');
      navigate('/admin');
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
    setPendingRedirect(false);
    closeAuthModal();
  }

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setLoading(false);
    setPendingRedirect(false);
  };

  const handleClose = () => {
    resetForm();
    setMode('signin');
  };

  const getTitle = () => {
    switch (mode) {
      case 'signin':
        return 'Welcome Back';
      case 'signup':
        return 'Create Account';
      case 'forgot':
        return 'Reset Password';
      default:
        return 'Welcome Back';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'signin':
        return 'Sign in to your account to continue';
      case 'signup':
        return 'Join AAYISH for delicious food delivery';
      case 'forgot':
        return 'Enter your email to receive a password reset link';
      default:
        return 'Sign in to your account to continue';
    }
  };

  const getSubmitButtonText = () => {
    if (loading) return 'Please wait...';
    switch (mode) {
      case 'signin':
        return 'Sign In';
      case 'signup':
        return 'Create Account';
      case 'forgot':
        return 'Send Reset Link';
      default:
        return 'Sign In';
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose();
        closeAuthModal();
      }
    }}>
      <DialogContent className="w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-0 border-border/40 shadow-2xl rounded-3xl">
         <DialogHeader className="px-8 pt-10 pb-6 text-center bg-secondary/5 border-b border-border/40">
           <div className="text-center">
             <DialogTitle className="text-3xl font-serif font-bold text-primary tracking-tight">AAYISH</DialogTitle>
             <h2 className="text-2xl font-bold text-foreground mt-4 font-serif">{getTitle()}</h2>
             <p className="text-base text-muted-foreground mt-2">{getDescription()}</p>
           </div>
         </DialogHeader>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Full Name</Label>
              <div className="relative">
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === 'signup'}
                  className="h-14 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
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
          
          {mode !== 'forgot' && (
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
                  className="h-14 pl-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                />
              </div>
              {mode === 'signin' && (
                <div className="text-right pt-1">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="pt-2">
            <Button type="submit" className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all" disabled={loading}>
              {getSubmitButtonText()}
            </Button>
          </div>
          
          {/* Only show Google Sign-In for signin and signup modes */}
          {mode !== 'forgot' && (
            <>
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
            </>
          )}
        </form>
        
        <div className="px-8 pb-8 pt-2 text-center space-y-2 bg-secondary/5 border-t border-border/40">
          {mode === 'signin' && (
            <p className="text-base text-muted-foreground">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-primary hover:text-primary/80 font-bold transition-colors ml-1"
              >
                Sign up
              </button>
            </p>
          )}
          
          {mode === 'signup' && (
            <p className="text-base text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary hover:text-primary/80 font-bold transition-colors ml-1"
              >
                Sign in
              </button>
            </p>
          )}
          
          {mode === 'forgot' && (
            <p className="text-base text-muted-foreground">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary hover:text-primary/80 font-bold transition-colors ml-1"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal; 