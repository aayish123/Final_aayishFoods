import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the access token and refresh token from URL params
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type');

  useEffect(() => {
    // Check if we have the required tokens for password reset
    if (!accessToken || !refreshToken || type !== 'recovery') {
      setError('Invalid or expired password reset link. Please request a new one.');
      return;
    }

    // Set the session with the tokens from the URL
    const setSession = async () => {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Session error:', error);
          setError('Invalid or expired password reset link. Please request a new one.');
        }
      } catch (err) {
        console.error('Session setup error:', err);
        setError('Failed to process reset link. Please try again.');
      }
    };

    setSession();
  }, [accessToken, refreshToken, type]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
        toast.error('Failed to reset password');
      } else {
        setSuccess(true);
        toast.success('Password reset successfully!');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 3000);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
      toast.error('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-2xl shadow-destructive/10 border border-destructive/20 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-10 pb-6 px-8">
            <Link to="/" className="inline-block mb-6">
              <span className="text-3xl font-serif font-bold text-primary tracking-tight">AAYISH</span>
            </Link>
            <CardTitle className="font-serif text-3xl font-bold text-destructive mb-2">Reset Link Error</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10 text-center">
            <Link to="/auth">
              <Button className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-2xl shadow-green-500/10 border border-green-500/20 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pt-10 pb-6 px-8">
            <Link to="/" className="inline-block mb-6">
              <span className="text-3xl font-serif font-bold text-primary tracking-tight">AAYISH</span>
            </Link>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <CardTitle className="font-serif text-3xl font-bold text-green-600 mb-2">Password Reset Success!</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Your password has been reset successfully. You will be redirected to the sign-in page shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10 text-center">
            <Link to="/auth">
              <Button className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all bg-green-600 hover:bg-green-700">
                Go to Sign In Now
              </Button>
            </Link>
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
          <CardTitle className="font-serif text-3xl font-bold text-foreground mb-2">Reset Your Password</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-14 pl-12 pr-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground pt-1">Password must be at least 6 characters long</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-14 pl-12 pr-12 rounded-xl bg-muted/30 border-border/60 focus-visible:ring-primary focus-visible:border-primary text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <div className="pt-2">
              <Button type="submit" className="w-full h-14 rounded-xl text-lg font-semibold shadow-md hover:shadow-lg transition-all" disabled={loading}>
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </Button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <Link to="/auth" className="inline-flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
