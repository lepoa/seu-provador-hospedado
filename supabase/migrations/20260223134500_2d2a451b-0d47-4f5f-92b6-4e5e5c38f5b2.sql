-- Defensive cleanup for order paid/cancel triggers.
-- Some environments may still have legacy triggers active, causing inconsistent stock flow.
-- Keep only canonical triggers:
--   - trg_order_paid -> public.handle_order_paid()
--   - trg_order_cancel_revert -> public.revert_stock_on_cancel()

DROP TRIGGER IF EXISTS trigger_decrement_stock_on_paid ON public.orders;
DROP TRIGGER IF EXISTS trigger_handle_order_paid ON public.orders;
DROP TRIGGER IF EXISTS orders_apply_paid_effects_on_paid ON public.orders;
DROP TRIGGER IF EXISTS trigger_revert_stock_on_cancel ON public.orders;

DROP TRIGGER IF EXISTS trg_order_paid ON public.orders;
CREATE TRIGGER trg_order_paid
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_paid();

DROP TRIGGER IF EXISTS trg_order_cancel_revert ON public.orders;
CREATE TRIGGER trg_order_cancel_revert
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_stock_on_cancel();
