import { useQuery } from '@tanstack/react-query';
import { customerService } from '@/shared/services/customerService';

export function useCustomerDetails(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => {
      if (!customerId) throw new Error('Customer ID is required');
      return customerService.fetchCustomerDetail(customerId);
    },
    enabled: !!customerId,
    staleTime: 60 * 1000
  });
}
