-- =======================================================
-- FIX: Create missing trigger on_live_cart_paid
-- =======================================================
-- PROBLEM: The trigger that automatically calls apply_live_cart_paid_effects
-- when live_carts.status changes to 'pago' was never created in production.
-- Without it, stock committed_by_size is never incremented when a live
-- order is paid, causing the stock to return to 'available' instead of 'sold'.
--
-- This trigger is the primary mechanism for stock commitment on live orders.
-- The frontend RPC call is a fallback.
-- =======================================================

CREATE OR REPLACE FUNCTION public.trigger_apply_live_cart_paid_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trigger_body$
BEGIN
  -- Only trigger when status changes TO 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    -- Only call if not already processed
    IF NEW.stock_decremented_at IS NULL THEN
      PERFORM apply_live_cart_paid_effects(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$trigger_body$;

DROP TRIGGER IF EXISTS on_live_cart_paid ON public.live_carts;

CREATE TRIGGER on_live_cart_paid
  AFTER UPDATE ON public.live_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_apply_live_cart_paid_effects();
