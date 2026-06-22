import { useQuery } from '@tanstack/react-query';
import { customerService } from '@/shared/services/customerService';

export function useCustomersList(page: number, pageSize: number, search: string, segment: string) {
  return useQuery({
    queryKey: ['customers', page, pageSize, search, segment],
    queryFn: () => customerService.fetchCustomersPaginated(page, pageSize, search, segment),
    staleTime: 2 * 60 * 1000
  });
}

export function useCustomerSegmentCounts() {
  return useQuery({
    queryKey: ['customerSegmentCounts'],
    queryFn: () => customerService.fetchCustomerSegmentCounts(),
    staleTime: 2 * 60 * 1000
  });
}
