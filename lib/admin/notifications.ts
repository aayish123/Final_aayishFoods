import { supabase } from '@/integrations/supabase/client';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'order' | 'coupon' | 'stock' | 'review' | 'system'
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        is_read: false
      });
    if (error) throw error;
  } catch (err) {
    console.error('Error creating database notification:', err);
  }
};

/**
 * Creates notifications for all administrative users.
 */
export const notifyAdmins = async (
  title: string,
  message: string,
  type: 'order' | 'coupon' | 'stock' | 'review' | 'system'
) => {
  try {
    // Fetch all profiles who are admin or have role in ('super_admin', 'manager', 'content_manager', 'inventory_manager', 'customer_support')
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id, role');

    if (error) throw error;

    const adminList = admins?.filter(p => 
      p.role === 'admin' || 
      ['super_admin', 'manager', 'content_manager', 'inventory_manager', 'customer_support'].includes(p.role)
    ) || [];

    if (adminList.length > 0) {
      const notifications = adminList.map(admin => ({
        user_id: admin.id,
        title,
        message,
        type,
        is_read: false
      }));

      await supabase.from('notifications').insert(notifications);
    }
  } catch (err) {
    console.error('Error notifying admins:', err);
  }
};
