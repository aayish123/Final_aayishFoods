import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '@/shared/services/productService';

export function useWishlist(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => {
      if (!userId) throw new Error('User ID is required');
      return productService.fetchWishlist(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const clearMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('User ID is required');
      return productService.clearWishlist(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', userId] });
    }
  });

  return {
    ...query,
    clearWishlist: clearMutation.mutateAsync,
    isClearing: clearMutation.isPending
  };
}
