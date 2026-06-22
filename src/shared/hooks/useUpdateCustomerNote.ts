import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService } from '@/shared/services/customerService';

export function useUpdateCustomerNote(customerId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { noteId: string; note: string }) =>
      customerService.updateCustomerNote(variables.noteId, variables.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    }
  });
}
