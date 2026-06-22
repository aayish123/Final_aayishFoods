import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService } from '@/shared/services/orderService';

export function useOrderNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { 
      orderId: string; 
      adminId: string; 
      note: string;
    }) => orderService.createOrderNote(variables.orderId, variables.adminId, variables.note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
    }
  });
}
