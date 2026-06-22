import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService } from '@/shared/services/orderService';

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { 
      orderId: string; 
      updates: Record<string, unknown>; 
      notes: string; 
      changedBy: string;
    }) => orderService.updateOrderStatus(variables.orderId, variables.updates, variables.notes, variables.changedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
    }
  });
}
