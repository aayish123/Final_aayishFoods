import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useInventoryMovements(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['inventoryMovements', page, pageSize],
    queryFn: () => inventoryService.fetchInventoryMovements(page, pageSize),
    staleTime: 30 * 1000
  });
}
