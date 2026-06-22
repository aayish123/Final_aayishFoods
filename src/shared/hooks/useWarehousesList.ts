import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useWarehousesList() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: () => inventoryService.fetchWarehouses(),
    staleTime: 60 * 1000
  });
}
