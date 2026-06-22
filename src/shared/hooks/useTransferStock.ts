import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useTransferStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      srcWarehouseId: string;
      destWarehouseId: string;
      variantId: string;
      quantity: number;
      reason: string;
      adminId: string;
    }) => inventoryService.transferStock(variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
    }
  });
}
