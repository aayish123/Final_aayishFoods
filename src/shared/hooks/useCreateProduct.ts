import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, ProductInput, VariantInput, SEOInput } from '@/shared/services/productService';

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { 
      product: ProductInput; 
      variants: Omit<VariantInput, 'id'>[]; 
      seo?: SEOInput;
    }) => productService.createProduct(variables.product, variables.variants, variables.seo),
    onSuccess: () => {
      // Invalidate queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
}
