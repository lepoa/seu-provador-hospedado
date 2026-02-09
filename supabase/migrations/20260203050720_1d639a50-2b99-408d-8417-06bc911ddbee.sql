-- Fix: Update trigger to set reserved_until based on order source
-- Catalog orders: 30 minutes
-- Live orders: Use live_events.reservation_expiry_minutes (default 10080 = 7 days)

CREATE OR REPLACE FUNCTION public.set_order_reserved_until()
RETURNS TRIGGER AS $$
DECLARE
  v_reservation_minutes int;
BEGIN
  -- Only set for aguardando_pagamento status when reserved_until is not already set
  IF NEW.status = 'aguardando_pagamento' AND NEW.reserved_until IS NULL THEN
    -- Check order source to determine reservation window
    IF NEW.source = 'live' AND NEW.live_event_id IS NOT NULL THEN
      -- Get reservation time from live event
      SELECT reservation_expiry_minutes INTO v_reservation_minutes
      FROM live_events
      WHERE id = NEW.live_event_id;
      
      -- Default to 7 days (10080 minutes) if not found
      v_reservation_minutes := COALESCE(v_reservation_minutes, 10080);
      
      NEW.reserved_until := now() + (v_reservation_minutes || ' minutes')::interval;
    ELSE
      -- Catalog orders: 30 minutes
      NEW.reserved_until := now() + interval '30 minutes';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Backfill: Update existing live orders with correct reserved_until
-- For live orders still awaiting payment, set reserved_until based on their live event config
UPDATE orders o
SET reserved_until = o.created_at + (
  COALESCE(
    (SELECT reservation_expiry_minutes FROM live_events WHERE id = o.live_event_id),
    10080  -- default 7 days
  ) || ' minutes'
)::interval
WHERE o.source = 'live'
  AND o.status = 'aguardando_pagamento'
  AND o.live_event_id IS NOT NULL;