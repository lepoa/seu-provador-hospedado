-- Drop the existing function first (return type changed)
DROP FUNCTION IF EXISTS public.expire_order_reservations();

-- Recreate with updated logic including cancel_reason and canceled_at
CREATE OR REPLACE FUNCTION public.expire_order_reservations()
RETURNS TABLE(expired_order_id uuid, previous_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE orders
    SET 
      status = 'cancelado',
      cancel_reason = 'reservation_expired',
      canceled_at = now(),
      updated_at = now()
    WHERE 
      status = 'aguardando_pagamento'
      AND reserved_until IS NOT NULL
      AND reserved_until < now()
    RETURNING id, 'aguardando_pagamento' as old_status
  )
  SELECT e.id, e.old_status FROM expired e;
END;
$$;