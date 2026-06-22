import { useMutation } from '@tanstack/react-query';
import { orderService, CheckoutInput } from '@/shared/services/orderService';

export function useCheckout() {
  return useMutation({
    mutationFn: (input: CheckoutInput) => orderService.createCheckoutOrder(input)
  });
}
