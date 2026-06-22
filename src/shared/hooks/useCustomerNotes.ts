import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService, CustomerNoteInput } from '@/shared/services/customerService';

export function useCustomerNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CustomerNoteInput) => customerService.createCustomerNote(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', variables.customerId] });
    }
  });
}
