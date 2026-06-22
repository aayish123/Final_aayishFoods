import { useQuery } from '@tanstack/react-query';
import { productService } from '@/shared/services/productService';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.fetchCategories(),
    staleTime: 10 * 60 * 1000, // Categories change rarely, cache for 10m
    refetchOnWindowFocus: false
  });
}
