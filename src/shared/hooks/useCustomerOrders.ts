import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/shared/services/orderService';

export function useCustomerOrders(userId: string | undefined, page: number = 1, pageSize: number = 5) {
  return useQuery({
    queryKey: ['customer-orders', userId, page, pageSize],
    queryFn: () => {
      if (!userId) throw new Error('User ID is required');
      return orderService.fetchCustomerOrders(userId, page, pageSize);
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // Caches for 30s
    refetchOnWindowFocus: false
  });
}
