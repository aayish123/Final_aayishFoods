import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useSaveWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (warehouse: { id?: string; name: string; location: string | null; is_active: boolean }) =>
      inventoryService.saveWarehouse(warehouse),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    }
  });
}
