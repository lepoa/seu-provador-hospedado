-- =============================================================================
-- MIGRATION: Fix reservation/expiration logic and stock commit for Live orders
-- =============================================================================

-- 1) Add attention/alert fields to orders for operational alerts
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS requires_physical_cancel boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS attention_reason text,
ADD COLUMN IF NOT EXISTS attention_at timestamptz;

-- 2) Update set_order_reserved_until to properly handle sources
-- This is the key fix: prevent catalog trigger from overwriting live orders with 30min
CREATE OR REPLACE FUNCTION public.set_order_reserved_until()
RETURNS TRIGGER AS $$
DECLARE
  v_reservation_minutes int;
BEGIN
  -- Only set for aguardando_pagamento status
  IF NEW.status = 'aguardando_pagamento' THEN
    -- If this is a new insert or status changed TO aguardando_pagamento
    IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'aguardando_pagamento') THEN
      -- Check order source to determine reservation window
      IF NEW.source = 'live' AND NEW.live_event_id IS NOT NULL THEN
        -- Get reservation time from live event
        SELECT reservation_expiry_minutes INTO v_reservation_minutes
        FROM live_events
        WHERE id = NEW.live_event_id;
        
        -- Default to 7 days (10080 minutes) if not found
        v_reservation_minutes := COALESCE(v_reservation_minutes, 10080);
        
        NEW.reserved_until := now() + (v_reservation_minutes || ' minutes')::interval;
      ELSIF NEW.source = 'catalog' OR NEW.source IS NULL THEN
        -- Catalog orders: 30 minutes
        NEW.reserved_until := now() + interval '30 minutes';
      ELSE
        -- For any other source, don't overwrite if already set
        IF NEW.reserved_until IS NULL THEN
          NEW.reserved_until := now() + interval '30 minutes';
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Clear reserved_until when order is paid or cancelled
  IF NEW.status IN ('pago', 'cancelado', 'entregue') THEN
    NEW.reserved_until := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS set_reserved_until_on_order ON public.orders;
CREATE TRIGGER set_reserved_until_on_order
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_reserved_until();

-- 3) Drop and recreate expire_order_reservations with new signature
DROP FUNCTION IF EXISTS public.expire_order_reservations();

CREATE OR REPLACE FUNCTION public.expire_order_reservations()
RETURNS TABLE(expired_order_id uuid, previous_status text, order_source text)
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
      updated_at = now(),
      -- Set attention flags for live orders that need physical bag cancellation
      requires_physical_cancel = CASE WHEN source = 'live' THEN true ELSE false END,
      attention_reason = CASE WHEN source = 'live' THEN 'reserva_live_expirada' ELSE NULL END,
      attention_at = CASE WHEN source = 'live' THEN now() ELSE NULL END
    WHERE 
      status = 'aguardando_pagamento'
      AND reserved_until IS NOT NULL
      AND reserved_until < now()
    RETURNING id, 'aguardando_pagamento' as old_status, source
  )
  SELECT e.id, e.old_status, e.source::text FROM expired e;
END;
$$;

-- Backfill: Update existing live orders with correct attention flags if they're cancelled
-- due to expiration but don't have the flags set
UPDATE orders
SET 
  requires_physical_cancel = true,
  attention_reason = 'reserva_live_expirada',
  attention_at = canceled_at
WHERE 
  source = 'live' 
  AND status = 'cancelado' 
  AND cancel_reason = 'reservation_expired'
  AND requires_physical_cancel IS NOT TRUE;

-- Backfill: Recalculate reserved_until for live orders still awaiting payment
UPDATE orders o
SET reserved_until = o.created_at + (
  COALESCE(
    (SELECT reservation_expiry_minutes FROM live_events WHERE id = o.live_event_id),
    10080
  ) || ' minutes'
)::interval
WHERE o.source = 'live'
  AND o.status = 'aguardando_pagamento'
  AND o.live_event_id IS NOT NULL;