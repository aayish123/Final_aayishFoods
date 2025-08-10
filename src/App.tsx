
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import Header from "@/components/Header";
import AuthModal from "@/components/AuthModal";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";

import Menu from "@/pages/Menu";
import Dashboard from "@/pages/Dashboard";
import Cart from "@/pages/Cart";
import Address from "@/pages/Address";
import Payment from "@/pages/Payment";
import Orders from "@/pages/Orders";
import Admin from "@/pages/Admin";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

const queryClient = new QueryClient();

// RequireAuth: Only allow authenticated users
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const location = useLocation();
  
  if (loading) return null;
  
  if (!user) {
    // Open auth modal instead of navigating
    openAuthModal();
    return null;
  }
  
  return children;
}

// RequireAdmin: Only allow admin users
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, role, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const location = useLocation();
  
  if (loading) return null;
  
  if (!user) {
    // Open auth modal instead of navigating
    openAuthModal();
    return null;
  }
  
  if (role !== "admin") return <Navigate to="/" replace />;
  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthModalProvider>
            <CartProvider>
              <div className="min-h-screen bg-white">
                <Header />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  {/* <Route path="/reset-password" element={<PasswordReset />} /> */}
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
                  <Route path="/address" element={<RequireAuth><Address /></RequireAuth>} />
                  <Route path="/payment" element={<RequireAuth><Payment /></RequireAuth>} />
                  <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
                  <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <AuthModal />
                {/* <PasswordResetModal /> */}
              </div>
            </CartProvider>
          </AuthModalProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
