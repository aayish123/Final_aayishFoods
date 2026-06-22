import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => inventoryService.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    }
  });
}
