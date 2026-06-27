import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const getPostLoginRoute = (role: string | null) => {
  if (role && role !== 'user') {
    return '/admin';
  }
  return '/menu';
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  isActive: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: unknown }>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signInWithGoogle: () => Promise<{ error: unknown }>;
  resetPassword: (email: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      return hash.includes('access_token=') || search.includes('code=');
    }
    return false;
  });
  const [redirectHandled, setRedirectHandled] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch user profile (including role) from Supabase
  const fetchUserProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('role, is_active')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Error fetching user profile:', error);
        setRole(null);
        setIsActive(false);
      } else {
        const active = data?.is_active ?? true;
        if (!active) {
          setRole(null);
          setIsActive(false);
          queryClient.clear();
          await supabase.auth.signOut();
          return;
        }
        setRole(data?.role || 'user');
        setIsActive(active);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          if (event === 'SIGNED_IN') {
            setIsSigningIn(true);
            setRedirectHandled(false);
          }
          await fetchUserProfile(session.user.id);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && user && role && isSigningIn && !redirectHandled) {
      setRedirectHandled(true);
      setIsSigningIn(false);
      
      const savedRedirect = sessionStorage.getItem('post_login_redirect');
      sessionStorage.removeItem('post_login_redirect');
      
      let targetRoute = savedRedirect || getPostLoginRoute(role);
      
      // Role boundary check for deep links
      if (role === 'user' && targetRoute.startsWith('/admin')) {
        targetRoute = '/menu';
      }
      if (role !== 'user' && (
        targetRoute === '/cart' || 
        targetRoute === '/wishlist' || 
        targetRoute === '/orders' || 
        targetRoute === '/dashboard' ||
        targetRoute === '/address' ||
        targetRoute === '/payment'
      )) {
        targetRoute = '/admin';
      }
      
      if (role && role !== 'user') {
        toast.success('Welcome Admin!');
      } else {
        toast.success('Welcome back!');
      }
      navigate(targetRoute, { replace: true });
    }
  }, [user, role, loading, isSigningIn, redirectHandled, navigate]);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setIsSigningIn(true);
      setRedirectHandled(false);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      if (error) {
        setIsSigningIn(false);
        return { error };
      }
      return { error: null };
    } catch (error) {
      setIsSigningIn(false);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsSigningIn(true);
      setRedirectHandled(false);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        setIsSigningIn(false);
        return { error };
      }
      if (data?.user) {
        await fetchUserProfile(data.user.id);
      }
      return { error: null };
    } catch (error) {
      setIsSigningIn(false);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsSigningIn(true);
      setRedirectHandled(false);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      if (error) {
        setIsSigningIn(false);
        return { error };
      }
      return { error: null };
    } catch (error) {
      setIsSigningIn(false);
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setRole(null);
      setIsSigningIn(false);
      setRedirectHandled(false);
      queryClient.clear();
      localStorage.removeItem('aayish_cart');
      localStorage.removeItem('simulated_role');
      sessionStorage.clear();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Signout error:', error);
      }
    } catch (error) {
      console.error('Signout exception:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    role,
    isActive,
    signUp,
    signIn,
    signInWithGoogle,
    resetPassword,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
