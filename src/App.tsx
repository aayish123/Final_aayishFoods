import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import LoadingScreen from "@/components/common/LoadingScreen";

const Landing = React.lazy(() => import("@/pages/Landing"));
const Auth = React.lazy(() => import("@/pages/Auth"));
const ResetPassword = React.lazy(() => import("@/pages/ResetPassword"));
const Menu = React.lazy(() => import("@/modules/products/Menu"));
const FoodItem = React.lazy(() => import("@/modules/products/FoodItem"));
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Cart = React.lazy(() => import("@/pages/Cart"));
const Address = React.lazy(() => import("@/pages/Address"));
const Payment = React.lazy(() => import("@/modules/orders/Payment"));
const Orders = React.lazy(() => import("@/modules/orders/Orders"));
const About = React.lazy(() => import("@/pages/About"));
const Offers = React.lazy(() => import("@/pages/Offers"));
const Wishlist = React.lazy(() => import("@/modules/products/Wishlist"));
const AdminLayout = React.lazy(() => import("@/components/admin/AdminLayout"));
const AdminDashboard = React.lazy(() => import("@/modules/dashboard/admin/Dashboard"));
const AdminProducts = React.lazy(() => import("@/modules/products/admin/Products"));
const AdminProductForm = React.lazy(() => import("@/modules/products/admin/ProductForm"));
const AdminCategories = React.lazy(() => import("@/modules/categories/admin/Categories"));
const AdminMedia = React.lazy(() => import("@/modules/media/admin/Media"));
const AdminOrders = React.lazy(() => import("@/modules/orders/admin/Orders"));
const AdminOrderDetail = React.lazy(() => import("@/modules/orders/admin/OrderDetail"));
const AdminFulfillment = React.lazy(() => import("@/modules/orders/admin/Fulfillment"));
const AdminCustomers = React.lazy(() => import("@/modules/customers/admin/Customers"));
const AdminCustomerDetail = React.lazy(() => import("@/modules/customers/admin/CustomerDetail"));
const AdminReviews = React.lazy(() => import("@/modules/reviews/admin/Reviews"));
const AdminCoupons = React.lazy(() => import("@/modules/coupons/admin/Coupons"));
const AdminBanners = React.lazy(() => import("@/modules/marketing/admin/Banners"));
const AdminInventory = React.lazy(() => import("@/modules/inventory/admin/Inventory"));
const AdminZones = React.lazy(() => import("@/modules/zones/admin/Zones"));
const AdminReports = React.lazy(() => import("@/modules/reports/admin/Reports"));
const AdminSettings = React.lazy(() => import("@/modules/settings/admin/Settings"));
const AdminUsers = React.lazy(() => import("@/modules/users/admin/Users"));
const AdminCMS = React.lazy(() => import("@/modules/cms/admin/CMS"));
const AdminMarketing = React.lazy(() => import("@/modules/marketing/admin/Marketing"));
const AdminPermissions = React.lazy(() => import("@/modules/users/admin/Permissions"));
const AdminAuditLogs = React.lazy(() => import("@/modules/audit/admin/AuditLogs"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

import { useAuth } from "@/contexts/AuthContext";
import { SessionTimeoutProvider } from "@/providers/SessionTimeoutProvider";
import { ConfirmProvider } from "@/components/common/ConfirmDialog";
import { useAuthModal } from "@/contexts/AuthModalContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 300000,  // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// RequireAuth: Only allow authenticated users
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const { openAuthModal, isGoogleOAuthInProgress } = useAuthModal();
  const location = useLocation();
  
  if (loading) return null;
  
  if (!user && !isGoogleOAuthInProgress) {
    // Open auth modal instead of navigating, but not during Google OAuth
    openAuthModal();
    return null;
  }
  
  return children;
}

// RequireAdmin: Only allow admin users
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, role, isActive, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  
  if (loading) return null;
  
  if (!user) {
    // Open auth modal instead of navigating
    openAuthModal();
    return null;
  }
  
  if (!isActive) {
    return <Navigate to="/" replace />;
  }
  
  if (!role || role === "user") return <Navigate to="/" replace />;
  return children;
}

function StorefrontLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <AuthModalProvider>
                <CartProvider>
                  <div className="min-h-screen bg-white">
                    <Suspense fallback={<LoadingScreen />}>
                      <Routes>
                        <Route element={<StorefrontLayout />}>
                          <Route path="/" element={<Landing />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/menu" element={<Menu />} />
                          <Route path="/food/:id" element={<FoodItem />} />
                          <Route path="/offers" element={<Offers />} />
                          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                          <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
                          <Route path="/address" element={<RequireAuth><Address /></RequireAuth>} />
                          <Route path="/payment" element={<RequireAuth><Payment /></RequireAuth>} />
                          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
                          <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
                          <Route path="/about" element={<About />} />
                          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                          <Route path="*" element={<NotFound />} />
                        </Route>

                        <Route path="/admin" element={<RequireAdmin><SessionTimeoutProvider><AdminLayout /></SessionTimeoutProvider></RequireAdmin>}>
                          <Route index element={<Navigate to="/admin/dashboard" replace />} />
                          <Route path="dashboard" element={<AdminDashboard />} />
                          <Route path="products" element={<AdminProducts />} />
                          <Route path="products/new" element={<AdminProductForm />} />
                          <Route path="products/:id/edit" element={<AdminProductForm />} />
                          <Route path="categories" element={<AdminCategories />} />
                          <Route path="media" element={<AdminMedia />} />
                          <Route path="orders" element={<AdminOrders />} />
                          <Route path="orders/:id" element={<AdminOrderDetail />} />
                          <Route path="fulfillment" element={<AdminFulfillment />} />
                          <Route path="customers" element={<AdminCustomers />} />
                          <Route path="customers/:id" element={<AdminCustomerDetail />} />
                          <Route path="reviews" element={<AdminReviews />} />
                          <Route path="coupons" element={<AdminCoupons />} />
                          <Route path="banners" element={<AdminBanners />} />
                          <Route path="inventory" element={<AdminInventory />} />
                          <Route path="zones" element={<AdminZones />} />
                          <Route path="reports" element={<AdminReports />} />
                          <Route path="settings" element={<AdminSettings />} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="users/permissions" element={<AdminPermissions />} />
                          <Route path="audit-logs" element={<AdminAuditLogs />} />
                          <Route path="cms" element={<AdminCMS />} />
                          <Route path="marketing" element={<AdminMarketing />} />
                        </Route>
                      </Routes>
                    </Suspense>
                    <AuthModal />
                  </div>
                </CartProvider>
              </AuthModalProvider>
            </ConfirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
