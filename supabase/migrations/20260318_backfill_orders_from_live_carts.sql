-- =======================================================
-- BACKFILL: Create orders for live_carts that are 'pago' but have no order
-- ROOT CAUSE: trigger_sync_live_cart_to_orders used wrong column names
-- (shipping_cost/discount instead of shipping_fee/coupon_discount)
-- This caused the trigger to silently fail for ALL live_carts since 2026-03-10.
-- =======================================================

-- STEP 1: Fix the trigger function with correct column names
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

        IF v_live_customer.client_id IS NOT NULL THEN
          v_customer_id := v_live_customer.client_id;
        ELSE
          SELECT id INTO v_customer_id
          FROM public.customers
          WHERE (public.normalize_phone_simple(phone) = v_norm_phone AND v_norm_phone IS NOT NULL AND v_norm_phone != '')
             OR (lower(trim(replace(instagram_handle, '@', ''))) = lower(trim(replace(v_live_customer.instagram_handle, '@', '')))
                 AND v_live_customer.instagram_handle IS NOT NULL AND v_live_customer.instagram_handle != '')
          ORDER BY created_at DESC LIMIT 1;

          IF v_customer_id IS NULL AND v_live_customer.whatsapp IS NOT NULL THEN
            INSERT INTO customers (phone, name, instagram_handle)
            VALUES (v_live_customer.whatsapp, v_live_customer.nome, v_live_customer.instagram_handle)
            RETURNING id INTO v_customer_id;
          END IF;
        END IF;

        -- FIX: Use correct column names (shipping_fee, coupon_discount, live_event_id, gateway)
        INSERT INTO orders (
          customer_id, customer_name, customer_phone, customer_address,
          status, total, subtotal, shipping_fee, coupon_discount,
          source, live_cart_id, live_event_id, live_bag_number,
          paid_at, gateway, delivery_method,
          reserved_until
        ) VALUES (
          v_customer_id, v_live_customer.nome, COALESCE(v_live_customer.whatsapp, ''),
          '',
          v_order_status, NEW.total, NEW.subtotal, NEW.frete, NEW.descontos,
          'live', NEW.id, NEW.live_event_id, NEW.bag_number,
          NEW.paid_at, NEW.paid_method, NEW.delivery_method,
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

-- STEP 2: Backfill orders for all paid live_carts without an order
DO $$
DECLARE
  r RECORD;
  v_order_id uuid;
  v_customer_id uuid;
  v_live_customer RECORD;
  v_live_event RECORD;
  v_norm_phone text;
  v_count int := 0;
BEGIN
  -- Guard: prevent the trigger from running during our manual inserts
  PERFORM set_config('app.syncing_live_cart', 'true', true);

  FOR r IN
    SELECT * FROM public.live_carts
    WHERE status = 'pago' AND order_id IS NULL
  LOOP
    BEGIN
      SELECT * INTO v_live_customer FROM public.live_customers WHERE id = r.live_customer_id;
      SELECT * INTO v_live_event FROM public.live_events WHERE id = r.live_event_id;
      v_norm_phone := public.normalize_phone_simple(v_live_customer.whatsapp);

      -- Find or create customer
      v_customer_id := NULL;
      IF v_live_customer.client_id IS NOT NULL THEN
        v_customer_id := v_live_customer.client_id;
      ELSE
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE (public.normalize_phone_simple(phone) = v_norm_phone AND v_norm_phone IS NOT NULL AND v_norm_phone != '')
           OR (lower(trim(replace(instagram_handle, '@', ''))) = lower(trim(replace(v_live_customer.instagram_handle, '@', '')))
               AND v_live_customer.instagram_handle IS NOT NULL AND v_live_customer.instagram_handle != '')
        ORDER BY created_at DESC LIMIT 1;

        IF v_customer_id IS NULL AND v_live_customer.whatsapp IS NOT NULL THEN
          INSERT INTO public.customers (phone, name, instagram_handle)
          VALUES (v_live_customer.whatsapp, v_live_customer.nome, v_live_customer.instagram_handle)
          RETURNING id INTO v_customer_id;
        END IF;
      END IF;

      -- Create order with CORRECT column names
      INSERT INTO public.orders (
        customer_id, customer_name, customer_phone, customer_address,
        status, total, subtotal, shipping_fee, coupon_discount,
        source, live_cart_id, live_event_id, live_bag_number,
        paid_at, gateway, delivery_method,
        reserved_until, created_at
      ) VALUES (
        v_customer_id, COALESCE(v_live_customer.nome, ''), COALESCE(v_live_customer.whatsapp, ''),
        '',
        'pago', r.total, r.subtotal, r.frete, r.descontos,
        'live', r.id, r.live_event_id, r.bag_number,
        r.paid_at, r.paid_method, r.delivery_method,
        now() + interval '7 days', r.created_at
      ) RETURNING id INTO v_order_id;

      -- Link cart to order
      UPDATE public.live_carts SET order_id = v_order_id WHERE id = r.id;

      -- Copy items
      PERFORM public.ensure_order_items_for_live_order(v_order_id);

      v_count := v_count + 1;
      RAISE NOTICE 'Created order % for cart % (%)', v_order_id, r.id, COALESCE(v_live_customer.nome, 'sem nome');

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed cart %: %', r.id, SQLERRM;
    END;
  END LOOP;

  PERFORM set_config('app.syncing_live_cart', 'false', true);
  RAISE NOTICE 'Done: % orders created', v_count;
END $$;
