import { useQuery } from '@tanstack/react-query';
import { productService } from '@/shared/services/productService';

export function useProductsList(filters?: { categoryId?: string; status?: string }) {
  return useQuery({
    queryKey: ['products', filters?.categoryId, filters?.status],
    queryFn: () => productService.fetchProducts(filters),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false
  });
}
