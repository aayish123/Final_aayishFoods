import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/shared/services/orderService';

export function useOrdersList(params: { 
  page: number; 
  pageSize: number; 
  statusFilter?: string; 
  searchTerm?: string;
}) {
  return useQuery({
    queryKey: ['orders', params.page, params.pageSize, params.statusFilter, params.searchTerm],
    queryFn: () => orderService.fetchOrders(params),
    staleTime: 30 * 1000, // Caches for 30s
    placeholderData: (previousData) => previousData // Maintain layout during page changes
  });
}
