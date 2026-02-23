-- Fix live order paid transition:
-- when admin marks a live order as "pago", reservation was released but sold
-- was not committed, returning units to available.
--
-- Strategy:
-- 1) Keep existing guards for recursion and RPC-controlled flow.
-- 2) For live orders, if live_cart already applied paid effects, just mirror stock_decremented_at.
-- 3) Otherwise commit sold using the same canonical path (commit_order_stock).

CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commit_result jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.syncing_live_cart', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Skip when payment is being processed via apply_paid_effects() RPC.
  IF current_setting('app.apply_paid_effects', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'pago' OR OLD.status = 'pago' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_decremented_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Live carts may have already committed stock through their own flow.
  IF COALESCE(NEW.source, 'catalog') = 'live' AND NEW.live_cart_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.live_carts lc
      WHERE lc.id = NEW.live_cart_id
        AND lc.stock_decremented_at IS NOT NULL
    ) OR EXISTS (
      SELECT 1
      FROM public.inventory_movements im
      WHERE im.order_id = NEW.live_cart_id
        AND im.movement_type IN ('live_sale_committed', 'live_sale_decrement', 'sale_committed', 'sale_decrement')
    ) THEN
      NEW.stock_decremented_at := COALESCE(NEW.stock_decremented_at, now());
      RETURN NEW;
    END IF;
  END IF;

  -- Canonical sold commit for catalog and live fallback.
  SELECT public.commit_order_stock(NEW.id)
    INTO v_commit_result;

  IF COALESCE((v_commit_result->>'success')::boolean, false) THEN
    NEW.stock_decremented_at := COALESCE(NEW.stock_decremented_at, now());
  END IF;

  RETURN NEW;
END;
$$;
