import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/shared/services/inventoryService';

export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { 
      warehouseId: string; 
      variantId: string; 
      changeQty: number; 
      reason: string; 
      adminId: string;
      type?: 'in' | 'out' | 'adjustment' | 'audit';
      reorderLevel?: number | null;
    }) => inventoryService.updateStockQuantity(
      variables.warehouseId, 
      variables.variantId, 
      variables.changeQty, 
      variables.reason, 
      variables.adminId,
      variables.type,
      variables.reorderLevel
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
    }
  });
}
