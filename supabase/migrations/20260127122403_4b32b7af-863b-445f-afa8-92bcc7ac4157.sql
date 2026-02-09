-- Create function to increment coupon uses
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons
  SET times_used = times_used + 1
  WHERE id = coupon_id;
END;
$$;