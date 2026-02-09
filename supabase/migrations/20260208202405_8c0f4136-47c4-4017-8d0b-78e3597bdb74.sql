
-- 1) Add unique constraint on payments(order_id, provider) so upsert works
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_provider_unique 
ON public.payments (order_id, provider);

-- 2) Recreate sync trigger function as SECURITY DEFINER so it bypasses RLS
CREATE OR REPLACE FUNCTION public.sync_order_status_from_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When payment status changes to approved, update order to pago
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.orders
    SET 
      status = 'pago',
      payment_status = 'approved',
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
    WHERE id = NEW.order_id
      AND status != 'pago'; -- Don't regress already-paid orders
  END IF;

  -- When payment is rejected
  IF NEW.status = 'rejected' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.orders
    SET 
      status = 'pagamento_rejeitado',
      payment_status = 'rejected',
      updated_at = now()
    WHERE id = NEW.order_id
      AND status NOT IN ('pago', 'enviado', 'entregue'); -- Don't regress advanced statuses
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Recreate the trigger (drop and recreate to ensure it uses the new function)
DROP TRIGGER IF EXISTS trg_sync_order_status_from_payment ON public.payments;

CREATE TRIGGER trg_sync_order_status_from_payment
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_status_from_payment();
