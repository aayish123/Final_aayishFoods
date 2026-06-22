import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useActiveVariants() {
  return useQuery({
    queryKey: ['activeVariants'],
    queryFn: () => inventoryService.fetchActiveVariants(),
    staleTime: 5 * 60 * 1000
  });
}
