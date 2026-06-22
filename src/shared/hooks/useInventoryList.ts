import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useInventoryList(
  page: number,
  pageSize: number,
  search: string,
  filterType: 'all' | 'critical' | 'warning' | 'healthy'
) {
  return useQuery({
    queryKey: ['inventory', page, pageSize, search, filterType],
    queryFn: () => inventoryService.fetchInventoryLedgerPaginated(page, pageSize, search, filterType),
    staleTime: 60 * 1000
  });
}

export function useInventoryStatusCounts() {
  return useQuery({
    queryKey: ['inventoryStatusCounts'],
    queryFn: () => inventoryService.fetchInventoryStatusCounts(),
    staleTime: 60 * 1000
  });
}
