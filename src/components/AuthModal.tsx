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
  const { signIn, signUp, resetPassword, role, user } = useAuth();
  const { isAuthModalOpen, closeAuthModal } = useAuthModal();
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const navigate = useNavigate();

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