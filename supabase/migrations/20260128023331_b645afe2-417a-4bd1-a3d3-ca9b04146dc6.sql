-- Enforce a minimum reservation window of 7 days (10080 minutes) for live events

CREATE OR REPLACE FUNCTION public.validate_live_event_reservation_expiry_minutes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reservation_expiry_minutes IS NULL THEN
    NEW.reservation_expiry_minutes := 10080;
  END IF;

  IF NEW.reservation_expiry_minutes < 10080 THEN
    RAISE EXCEPTION 'reservation_expiry_minutes must be at least 10080 minutes (7 days)';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'validate_live_events_reservation_expiry_minutes'
  ) THEN
    CREATE TRIGGER validate_live_events_reservation_expiry_minutes
    BEFORE INSERT OR UPDATE OF reservation_expiry_minutes ON public.live_events
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_live_event_reservation_expiry_minutes();
  END IF;
END;
$$;