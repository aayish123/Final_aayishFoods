import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { toast } from 'sonner';

type AuthMode = 'signin' | 'signup' | 'forgot';

const AuthModal = () => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp, resetPassword, signInWithGoogle, role, user } = useAuth();
  const { isAuthModalOpen, closeAuthModal } = useAuthModal();
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error('Google sign-in failed. Please try again.');
      } else {
        toast.success('Redirecting to Google...');
        // Google OAuth will redirect, so we don't need to handle success here
      }
    } catch (error) {
      toast.error('An unexpected error occurred during Google sign-in');
      console.error('Google sign-in error:', error);
    } finally {
      setGoogleLoading(false);
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
    if (role === 'admin') {
      toast.success('Welcome Admin!');
      navigate('/admin');
    } else {
      toast.success('Welcome back!');
      navigate('/');
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
      <DialogContent className="sm:max-w-md">
                 <DialogHeader>
           <div className="text-center">
             <DialogTitle className="text-2xl font-bold text-orange-600">AAYISH</DialogTitle>
             <h2 className="text-xl font-semibold mt-2">{getTitle()}</h2>
             <p className="text-sm text-gray-600 mt-1">{getDescription()}</p>
           </div>
         </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={mode === 'signup'}
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
          
          {mode !== 'forgot' && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
               
              />
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={loading}>
            {getSubmitButtonText()}
          </Button>
          
          {/* Only show Google Sign-In for signin and signup modes */}
          {mode !== 'forgot' && (
            <>
              {/* Divider */}
              <div className="relative my-4">
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
            </>
          )}
        </form>
        
        <div className="mt-6 text-center space-y-2">
          {mode === 'signin' && (
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-orange-600 hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          )}
          
          {mode === 'signup' && (
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-orange-600 hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          )}
          
          {mode === 'signin' && (
            <p className="text-sm text-gray-600">
              {/* <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-orange-600 hover:underline font-medium"
              >
                Forgot your password?
              </button> */}
            </p>
          )}
          
          {mode === 'forgot' && (
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-orange-600 hover:underline font-medium"
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