import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productService, ProductInput, VariantInput, SEOInput } from '@/shared/services/productService';

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { 
      id: string;
      product: Partial<ProductInput>; 
      variants: VariantInput[]; 
      seo?: SEOInput;
    }) => productService.updateProduct(variables.id, variables.product, variables.variants, variables.seo),
    onSuccess: (_, variables) => {
      // Invalidate queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
    }
  });
}
