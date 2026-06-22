import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  Check,
  CheckCheck,
  ShoppingCart,
  Star,
  AlertTriangle,
  FileText,
  Shield,
  Megaphone,
  UserCheck,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface DbNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // 1. Fetch latest 20 notifications
  const { data: notifications = [], refetch } = useQuery<DbNotification[]>({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as DbNotification[];
    },
    enabled: !!userId,
  });

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // 2. Realtime Subscription for database changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          refetch();
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as DbNotification;
            toast.info(newNotif.title, {
              description: newNotif.message,
              action: {
                label: 'Read',
                onClick: () => markSingleReadMutation.mutate(newNotif.id),
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  // 3. Mark single notification as read
  const markSingleReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
    onError: (err) => {
      console.error('Failed to mark notification as read:', err);
      toast.error('Could not mark notification as read.');
    },
  });

  // 4. Mark all notifications as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      toast.success('All notifications marked as read.');
    },
    onError: (err) => {
      console.error('Failed to mark all notifications as read:', err);
      toast.error('Could not mark all notifications as read.');
    },
  });

  // Helper to determine icon, color based on notification type
  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'order':
        return {
          icon: ShoppingCart,
          bg: 'bg-blue-50 text-blue-600 border-blue-100',
        };
      case 'review':
        return {
          icon: Star,
          bg: 'bg-amber-50 text-amber-600 border-amber-100',
        };
      case 'stock':
      case 'inventory':
        return {
          icon: AlertTriangle,
          bg: 'bg-orange-50 text-orange-600 border-orange-100',
        };
      case 'cms':
        return {
          icon: FileText,
          bg: 'bg-purple-50 text-purple-600 border-purple-100',
        };
      case 'security':
      case 'system':
        return {
          icon: Shield,
          bg: 'bg-red-50 text-red-600 border-red-100',
        };
      case 'marketing':
        return {
          icon: Megaphone,
          bg: 'bg-teal-50 text-teal-600 border-teal-100',
        };
      case 'user':
        return {
          icon: UserCheck,
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        };
      default:
        return {
          icon: Bell,
          bg: 'bg-gray-50 text-gray-600 border-gray-100',
        };
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="relative h-11 w-11 rounded-full border-gray-200 hover:bg-[#fdfbf7] text-gray-700 focus-visible:ring-[#1a3b2b] flex items-center justify-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-[#5c2018] text-white flex items-center justify-center text-[10px] px-1 hover:bg-[#5c2018]/90 font-bold border-2 border-white animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[92vw] sm:w-[380px] rounded-2xl shadow-xl border border-gray-100 bg-white p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-[#fdfbf7]/50">
          <div className="flex items-center space-x-2">
            <span className="font-serif font-bold text-[#5c2018]">Notifications</span>
            {unreadCount > 0 && (
              <Badge className="bg-[#5c2018] text-white hover:bg-[#5c2018] font-bold text-[10px] rounded-full">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-[#1a3b2b] hover:text-[#1a3b2b] hover:bg-emerald-50/50 h-8 px-2 rounded-lg font-semibold flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
              <Bell className="h-8 w-8 text-gray-300 mb-2 stroke-1.5" />
              <p className="text-xs font-medium">All caught up!</p>
              <p className="text-[10px] text-gray-400 mt-0.5">No notifications received yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((notif) => {
                const styles = getNotificationStyles(notif.type);
                const IconComponent = styles.icon;
                return (
                  <div
                    key={notif.id}
                    className={`p-4 flex gap-3 transition-colors relative group ${
                      notif.is_read ? 'bg-white opacity-85' : 'bg-amber-50/30'
                    }`}
                  >
                    {/* Unread dot */}
                    {!notif.is_read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#d4af37] rounded-full" />
                    )}

                    {/* Icon */}
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 ${styles.bg}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex justify-between items-start">
                        <p className={`text-xs truncate ${notif.is_read ? 'text-gray-700' : 'font-bold text-gray-900'}`}>
                          {notif.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed break-words">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-1">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>

                    {/* Mark as read action */}
                    {!notif.is_read && (
                      <div className="flex items-center self-center shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => markSingleReadMutation.mutate(notif.id)}
                          className="h-7 w-7 rounded-full text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 focus:opacity-100"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DropdownMenuSeparator className="m-0 bg-gray-50" />
        <div className="p-2.5 bg-[#fdfbf7]/50 text-center">
          <Button
            asChild
            variant="link"
            className="w-full text-xs font-bold text-[#5c2018] hover:text-[#5c2018] focus-visible:ring-[#1a3b2b] h-auto py-1"
          >
            <a href="/admin/audit-logs">View All Notifications</a>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
