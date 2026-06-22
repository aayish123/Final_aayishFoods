export type AdminRole =
  | 'super_admin'
  | 'manager'
  | 'content_manager'
  | 'inventory_manager'
  | 'customer_support';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'all';

export type PermissionSubject =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'reviews'
  | 'coupons'
  | 'banners'
  | 'inventory'
  | 'reports'
  | 'settings'
  | 'users'
  | 'cms'
  | 'marketing'
  | 'fulfillment'
  | 'zones'
  | 'media'
  | 'all';

export interface Permission {
  action: PermissionAction;
  subject: PermissionSubject;
}

// Client-side mapping of roles to their allowed action/subject permissions.
// This matches the database role seeding constraints.
const ROLE_PERMISSIONS: Record<AdminRole | 'admin' | 'user', Permission[]> = {
  super_admin: [{ action: 'all', subject: 'all' }],
  admin: [{ action: 'all', subject: 'all' }], // Legacy admin compatibility
  manager: [
    { action: 'all', subject: 'dashboard' },
    { action: 'all', subject: 'products' },
    { action: 'all', subject: 'categories' },
    { action: 'all', subject: 'orders' },
    { action: 'all', subject: 'customers' },
    { action: 'all', subject: 'reviews' },
    { action: 'all', subject: 'coupons' },
    { action: 'all', subject: 'banners' },
    { action: 'all', subject: 'inventory' },
    { action: 'all', subject: 'reports' },
    { action: 'all', subject: 'cms' },
    { action: 'all', subject: 'marketing' },
    { action: 'all', subject: 'fulfillment' },
    { action: 'all', subject: 'zones' },
    { action: 'view', subject: 'settings' },
    { action: 'view', subject: 'users' },
  ],
  content_manager: [
    { action: 'all', subject: 'dashboard' },
    { action: 'all', subject: 'products' },
    { action: 'all', subject: 'categories' },
    { action: 'all', subject: 'reviews' },
    { action: 'all', subject: 'banners' },
    { action: 'all', subject: 'cms' },
    { action: 'all', subject: 'marketing' },
    { action: 'view', subject: 'orders' },
    { action: 'view', subject: 'customers' },
  ],
  inventory_manager: [
    { action: 'all', subject: 'dashboard' },
    { action: 'view', subject: 'products' },
    { action: 'all', subject: 'inventory' },
    { action: 'view', subject: 'reports' },
  ],
  customer_support: [
    { action: 'all', subject: 'dashboard' },
    { action: 'view', subject: 'products' },
    { action: 'view', subject: 'categories' },
    { action: 'view', subject: 'orders' },
    { action: 'edit', subject: 'orders' }, // support updates status / tracking
    { action: 'manage', subject: 'fulfillment' },
    { action: 'view', subject: 'customers' },
    { action: 'manage', subject: 'reviews' }, // moderate customer reviews
    { action: 'view', subject: 'coupons' },
  ],
  user: [],
};

/**
 * Checks if a given role has permission to perform an action on a subject.
 */
export const checkPermission = (
  role: string | null,
  action: PermissionAction,
  subject: PermissionSubject
): boolean => {
  if (!role) return false;
  
  const mappedRole = role.toLowerCase() as AdminRole | 'admin' | 'user';
  const permissions = ROLE_PERMISSIONS[mappedRole];
  
  if (!permissions) return false;
  
  // super_admin and legacy 'admin' bypass all checks
  if (mappedRole === 'super_admin' || mappedRole === 'admin') return true;
  
  return permissions.some(
    (perm) =>
      (perm.action === 'all' || perm.action === action) &&
      (perm.subject === 'all' || perm.subject === subject)
  );
};
