-- =======================================================
-- FIX: Restore 7-day reserved_until for live orders
-- Bug: migration 20260310 replaced trigger_sync_live_cart_to_orders()
--      without including reserved_until in the INSERT, causing live
--      orders to default to 24h reservation instead of 7 days.
-- =======================================================

-- 1) Fix trigger_sync_live_cart_to_orders: add reserved_until back to INSERT
CREATE OR REPLACE FUNCTION public.trigger_sync_live_cart_to_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_customer_id uuid;
  v_live_customer RECORD;
  v_live_event RECORD;
  v_order_status text;
  v_norm_phone text;
BEGIN
  IF current_setting('app.syncing_order', true) = 'true' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status
     AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at
     AND OLD.total IS NOT DISTINCT FROM NEW.total THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_live_cart', 'true', true);

  BEGIN
    SELECT * INTO v_live_customer FROM live_customers WHERE id = NEW.live_customer_id;
    SELECT * INTO v_live_event FROM live_events WHERE id = NEW.live_event_id;
    v_norm_phone := public.normalize_phone_simple(v_live_customer.whatsapp);

    v_order_status := CASE NEW.status
      WHEN 'aberto' THEN 'pendente'
      WHEN 'em_confirmacao' THEN 'aguardando_pagamento'
      WHEN 'aguardando_pagamento' THEN 'aguardando_pagamento'
      WHEN 'pago' THEN 'pago'
      WHEN 'cancelado' THEN 'cancelado'
      WHEN 'expirado' THEN 'cancelado'
      ELSE 'pendente'
    END;

    SELECT id INTO v_order_id FROM orders WHERE live_cart_id = NEW.id;

    IF v_order_id IS NOT NULL THEN
      UPDATE orders SET status = v_order_status, total = NEW.total, subtotal = NEW.subtotal, updated_at = now()
      WHERE id = v_order_id AND status IS DISTINCT FROM v_order_status;
    ELSE
      IF NEW.status IN ('em_confirmacao', 'aguardando_pagamento', 'pago') THEN

        -- Find or create customer (improved search with normalization)
        IF v_live_customer.client_id IS NOT NULL THEN
          v_customer_id := v_live_customer.client_id;
        ELSE
          SELECT id INTO v_customer_id
          FROM public.customers
          WHERE (public.normalize_phone_simple(phone) = v_norm_phone AND v_norm_phone IS NOT NULL)
             OR (lower(trim(replace(instagram_handle, '@', ''))) = lower(trim(replace(v_live_customer.instagram_handle, '@', ''))) AND v_live_customer.instagram_handle IS NOT NULL)
          ORDER BY created_at DESC LIMIT 1;

          IF v_customer_id IS NULL AND v_live_customer.whatsapp IS NOT NULL THEN
            INSERT INTO customers (phone, name, instagram_handle)
            VALUES (v_live_customer.whatsapp, v_live_customer.nome, v_live_customer.instagram_handle)
            RETURNING id INTO v_customer_id;
          END IF;
        END IF;

        -- FIX: Include reserved_until with 7-day window from live event
        INSERT INTO orders (
          customer_id, status, total, subtotal, shipping_cost, discount, source,
          live_cart_id, live_id, live_bag_number, paid_at, paid_method,
          delivery_method, customer_name, customer_phone,
          reserved_until
        ) VALUES (
          v_customer_id, v_order_status, NEW.total, NEW.subtotal, NEW.frete, NEW.descontos, 'live',
          NEW.id, NEW.live_event_id, NEW.bag_number, NEW.paid_at, NEW.paid_method,
          NEW.delivery_method, v_live_customer.nome, v_live_customer.whatsapp,
          now() + (COALESCE(v_live_event.reservation_expiry_minutes, 10080) || ' minutes')::interval
        ) RETURNING id INTO v_order_id;

        UPDATE live_carts SET order_id = v_order_id WHERE id = NEW.id;
        PERFORM public.ensure_order_items_for_live_order(v_order_id);
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_sync_live_cart_to_orders error: %', SQLERRM;
  END;

  PERFORM set_config('app.syncing_live_cart', 'false', true);
  RETURN NEW;
END;
$$;

-- 2) Safety net: update set_order_reserved_until to use 7 days for live orders
CREATE OR REPLACE FUNCTION public.set_order_reserved_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'manter_na_reserva' THEN
    NEW.reserved_until := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('aguardando_pagamento', 'pendente', 'aguardando_retorno', 'aguardando_validacao_pagamento') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      -- Live orders get 7 days (10080 min); catalog orders get 24 hours
      IF COALESCE(NEW.source, 'catalog') = 'live' THEN
        NEW.reserved_until := COALESCE(NEW.reserved_until, now() + interval '7 days');
      ELSE
        NEW.reserved_until := COALESCE(NEW.reserved_until, now() + interval '24 hours');
      END IF;
    ELSIF NEW.reserved_until IS NULL THEN
      IF COALESCE(NEW.source, 'catalog') = 'live' THEN
        NEW.reserved_until := now() + interval '7 days';
      ELSE
        NEW.reserved_until := now() + interval '24 hours';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('pago', 'cancelado', 'expirado', 'pagamento_rejeitado', 'reembolsado', 'entregue') THEN
    NEW.reserved_until := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Backfill: Restore live orders that were incorrectly expired
--    These are orders with source='live', cancel_reason='reservation_expired',
--    whose live_carts are still active (not cancelled/expired/pago).
UPDATE orders o
SET
  status = 'aguardando_pagamento',
  cancel_reason = NULL,
  canceled_at = NULL,
  requires_physical_cancel = false,
  attention_reason = NULL,
  attention_at = NULL,
  reserved_until = o.created_at + (
    COALESCE(
      (SELECT reservation_expiry_minutes FROM live_events le WHERE le.id = o.live_event_id),
      10080
    ) || ' minutes'
  )::interval,
  updated_at = now()
WHERE o.source = 'live'
  AND o.status = 'cancelado'
  AND o.cancel_reason = 'reservation_expired'
  AND o.live_cart_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM live_carts lc
    WHERE lc.id = o.live_cart_id
      AND lc.status NOT IN ('cancelado', 'expirado', 'pago')
  );

-- 4) Also fix any live orders still pending that have a 24h reserved_until
--    (created after the buggy migration but not yet expired)
UPDATE orders o
SET
  reserved_until = o.created_at + (
    COALESCE(
      (SELECT reservation_expiry_minutes FROM live_events le WHERE le.id = o.live_event_id),
      10080
    ) || ' minutes'
  )::interval,
  updated_at = now()
WHERE o.source = 'live'
  AND o.status IN ('aguardando_pagamento', 'pendente')
  AND o.live_cart_id IS NOT NULL
  AND o.reserved_until IS NOT NULL
  AND o.reserved_until < o.created_at + interval '2 days'  -- Only fix the ones with ~24h reservation
  AND o.live_event_id IS NOT NULL;
