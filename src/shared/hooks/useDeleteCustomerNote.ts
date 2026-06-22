import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService } from '@/shared/services/customerService';

export function useDeleteCustomerNote(customerId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => customerService.deleteCustomerNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    }
  });
}
