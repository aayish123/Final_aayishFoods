import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { checkPermission, AdminRole, PermissionSubject } from '@/lib/admin/permissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image as ImageIcon,
  ShoppingCart,
  Users,
  Star,
  Ticket,
  Sliders,
  Warehouse,
  FileBarChart2,
  Settings,
  ShieldAlert,
  Edit,
  Menu,
  X,
  LogOut,
  Bell,
  MapPin,
  Megaphone,
  Truck,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import NotificationBell from './NotificationBell';
import { useConfirm } from '@/components/common/ConfirmDialog';



interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  subject: PermissionSubject;
  phase: string;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, subject: 'dashboard', phase: 'Phase 1' },
  { name: 'Products', href: '/admin/products', icon: Package, subject: 'products', phase: 'Phase 1' },
  { name: 'Categories', href: '/admin/categories', icon: FolderTree, subject: 'categories', phase: 'Phase 1' },
  { name: 'Media Library', href: '/admin/media', icon: ImageIcon, subject: 'media', phase: 'Phase 1' },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingCart, subject: 'orders', phase: 'Phase 2' },
  { name: 'Fulfillment Center', href: '/admin/fulfillment', icon: Truck, subject: 'fulfillment', phase: 'Phase 2' },
  { name: 'Customers', href: '/admin/customers', icon: Users, subject: 'customers', phase: 'Phase 2' },
  { name: 'Reviews', href: '/admin/reviews', icon: Star, subject: 'reviews', phase: 'Phase 2' },
  { name: 'Coupons', href: '/admin/coupons', icon: Ticket, subject: 'coupons', phase: 'Phase 3' },
  { name: 'Banners', href: '/admin/banners', icon: Sliders, subject: 'banners', phase: 'Phase 3' },
  { name: 'Inventory & Stock', href: '/admin/inventory', icon: Warehouse, subject: 'inventory', phase: 'Phase 3' },
  { name: 'Delivery Zones', href: '/admin/zones', icon: MapPin, subject: 'zones', phase: 'Phase 3' },
  { name: 'Reports & Export', href: '/admin/reports', icon: FileBarChart2, subject: 'reports', phase: 'Phase 4' },
  { name: 'CMS Editor', href: '/admin/cms', icon: Edit, subject: 'cms', phase: 'Phase 4' },
  { name: 'Admin Users', href: '/admin/users', icon: ShieldAlert, subject: 'users', phase: 'Phase 4' },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: History, subject: 'users', phase: 'Phase 4' },
  { name: 'Store Settings', href: '/admin/settings', icon: Settings, subject: 'settings', phase: 'Phase 4' },
  { name: 'Marketing Center', href: '/admin/marketing', icon: Megaphone, subject: 'marketing', phase: 'Phase 5' },
];

export default function AdminLayout() {
  const { user, signOut, role: authRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (window.formIsDirty) {
      e.preventDefault();
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Leaving this page will discard your modifications. Are you sure you want to continue?',
        confirmText: 'Discard & Leave',
        cancelText: 'Stay Here',
        variant: 'warning',
        onConfirm: () => {
          window.formIsDirty = false;
          navigate(href);
          setMobileMenuOpen(false);
        }
      });
    } else {
      setMobileMenuOpen(false);
    }
  };
  
  // Role override state for testing permission flows locally
  const [activeRole, setActiveRole] = useState<string>(() => {
    return localStorage.getItem('simulated_role') || authRole || 'super_admin';
  });

  // Fetch active permissions dynamically from DB, cached in React Query
  const { data: dbPermissions } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          roles (name),
          permissions (action, subject)
        `);
      if (error) throw error;
      return data;
    }
  });

  const hasPermission = (subject: PermissionSubject) => {
    if (activeRole === 'super_admin' || activeRole === 'admin') return true;

    if (dbPermissions && dbPermissions.length > 0) {
      return dbPermissions.some((rp: { 
        roles: { name: string } | null; 
        permissions: { action: string; subject: string } | null; 
      }) => {
        const rName = rp.roles?.name?.toLowerCase();
        const targetRole = activeRole.toLowerCase();
        const action = 'view';
        
        const act = rp.permissions?.action;
        const subj = rp.permissions?.subject;

        return rName === targetRole && 
               (act === 'all' || act === action) && 
               (subj === 'all' || subj === subject);
      });
    }

    // Fallback to static checkPermission
    return checkPermission(activeRole, 'view', subject);
  };

  const handleRoleChange = (newRole: string) => {
    setActiveRole(newRole);
    localStorage.setItem('simulated_role', newRole);
    toast.info(`Switched interface role simulation to: ${newRole.replace('_', ' ').toUpperCase()}`);
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('simulated_role');
      await signOut();
      toast.success('Logged out successfully');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error('Signout failed');
    }
  };

  const filteredNavItems = NAVIGATION_ITEMS.filter((item) =>
    hasPermission(item.subject)
  );

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-[#5c2018] text-white shrink-0 border-r border-[#1a3b2b]/20 shadow-2xl">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-8 border-b border-[#4a1811]">
          <Link to="/" className="flex items-center space-x-3">
            <span className="text-2xl font-serif font-bold text-[#d4af37] tracking-wider uppercase">Aayish Foods</span>
            <span className="bg-[#1a3b2b] text-[#fdfbf7] text-[10px] px-2 py-0.5 rounded font-sans uppercase border border-[#d4af37]/20">Portal</span>
          </Link>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium ${
                  isActive
                    ? 'bg-[#1a3b2b] text-[#d4af37] shadow-lg shadow-[#122b20]/30 border-l-4 border-[#d4af37]'
                    : 'text-[#fdfbf7]/80 hover:bg-[#4a1811] hover:text-[#d4af37]'
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[#d4af37]' : 'text-[#fdfbf7]/60 group-hover:text-[#d4af37] transition-colors'}`} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#4a1811] bg-[#4a1811]/40">
          {/* Simulated Role Controller */}
          <div className="space-y-1.5 mb-4">
            <label className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider">Simulated Staff Role</label>
            <select
              value={activeRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full h-9 px-2 rounded-lg bg-[#5c2018] border border-[#d4af37]/30 text-xs font-semibold text-[#fdfbf7] focus:ring-1 focus:ring-[#d4af37] focus:outline-none"
            >
              <option value="super_admin">Super Admin</option>
              <option value="manager">Store Manager</option>
              <option value="content_manager">Content Manager</option>
              <option value="inventory_manager">Inventory Manager</option>
              <option value="customer_support">Customer Support</option>
            </select>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-4 py-2.5 text-sm font-semibold rounded-xl text-red-200 hover:bg-red-950/40 hover:text-red-100 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)}>
          <aside className="w-72 bg-[#5c2018] text-white flex flex-col h-dvh animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="h-20 flex justify-between items-center px-6 border-b border-[#4a1811]">
              <span className="text-xl font-serif font-bold text-[#d4af37] tracking-wider uppercase">Aayish Admin</span>
              <Button variant="ghost" onClick={() => setMobileMenuOpen(false)} className="h-11 w-11 text-white hover:bg-[#4a1811] flex items-center justify-center">
                <X className="h-6 w-6" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-medium ${
                      isActive
                        ? 'bg-[#1a3b2b] text-[#d4af37] border-l-4 border-[#d4af37]'
                        : 'text-[#fdfbf7]/80 hover:bg-[#4a1811] hover:text-[#d4af37]'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#4a1811]">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-semibold rounded-xl text-red-200 hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-20 bg-white border-b border-[#1a3b2b]/10 flex items-center justify-between px-6 lg:px-8 shadow-sm">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="lg:hidden h-11 w-11 hover:bg-gray-100 flex items-center justify-center" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-6 w-6 text-gray-700" />
            </Button>
            <div className="hidden sm:block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Traditional Aayish Design System
            </div>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center space-x-4">
            {/* Notification Drawer Trigger */}
            <NotificationBell />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 hover:opacity-85 transition-opacity focus:outline-none">
                  <Avatar className="h-10 w-10 border-2 border-[#d4af37] shadow-sm">
                    <AvatarImage src={user?.user_metadata?.avatar_url || ''} />
                    <AvatarFallback className="bg-[#1a3b2b] text-[#d4af37] font-bold">
                      {user?.email?.slice(0, 2).toUpperCase() || 'AD'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {user?.user_metadata?.full_name || 'Admin staff'}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                      {activeRole.replace('_', ' ')}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-gray-100">
                <DropdownMenuLabel className="font-serif text-[#5c2018] text-base">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs text-gray-500 font-medium">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/')} className="hover:bg-[#fdfbf7] cursor-pointer">
                  Customer Portal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:bg-red-50 cursor-pointer">
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Outlet View */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#fdfbf7]/40">
          <Outlet context={{ simulatedRole: activeRole }} />
        </main>
      </div>
    </div>
  );
}
