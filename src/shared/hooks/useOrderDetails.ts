import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/shared/services/orderService';

export function useOrderDetails(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => {
      if (!orderId) throw new Error('Order ID is required');
      return orderService.fetchOrderDetail(orderId);
    },
    enabled: !!orderId,
    staleTime: 10 * 1000
  });
}
