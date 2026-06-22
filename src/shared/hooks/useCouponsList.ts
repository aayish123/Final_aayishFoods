import { useQuery } from '@tanstack/react-query';
import { couponService } from '@/shared/services/couponService';

export function useCouponsList() {
  return useQuery({
    queryKey: ['coupons'],
    queryFn: () => couponService.fetchCoupons(),
    staleTime: 5 * 60 * 1000
  });
}
