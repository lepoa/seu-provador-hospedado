-- =======================================================
-- FIX: Live reservation system - multiple regression fixes
-- Bug 1: migration 20260310 dropped reserved_until from order INSERT
-- Bug 2: live_cart_items expiring to 'expirado' releasing stock
-- Bug 3: apply_live_cart_paid_effects only processed 'confirmado' items,
--         ignoring 'reservado' items when manually marking as paid
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

-- 3) Fix apply_live_cart_paid_effects to include 'reservado' items (for manual payments)
CREATE OR REPLACE FUNCTION public.apply_live_cart_paid_effects(p_live_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cart RECORD;
  v_item RECORD;
  v_committed JSONB;
  v_newCommitted JSONB;
  v_size TEXT;
  v_items_committed JSONB := '[]'::jsonb;
  v_movement_exists BOOLEAN;
BEGIN
  SELECT * INTO v_cart FROM live_carts WHERE id = p_live_cart_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Live cart not found');
  END IF;

  IF v_cart.stock_decremented_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_processed', true,
      'live_cart_id', p_live_cart_id,
      'message', 'Stock already committed at ' || v_cart.stock_decremented_at::text
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM inventory_movements 
    WHERE order_id = p_live_cart_id 
    AND movement_type IN ('live_sale_decrement', 'live_sale_committed')
  ) INTO v_movement_exists;

  IF v_movement_exists THEN
    UPDATE live_carts SET stock_decremented_at = now() WHERE id = p_live_cart_id;
    RETURN jsonb_build_object(
      'success', true, 
      'already_processed', true,
      'reason', 'Movement already exists',
      'live_cart_id', p_live_cart_id
    );
  END IF;

  -- FIX: Include both 'confirmado' AND 'reservado' items
  FOR v_item IN
    SELECT 
      lci.product_id,
      (lci.variante->>'tamanho')::text as size,
      lci.qtd as quantity
    FROM live_cart_items lci
    WHERE lci.live_cart_id = p_live_cart_id
    AND lci.status IN ('confirmado', 'reservado')
  LOOP
    v_size := v_item.size;
    IF v_size IS NULL OR v_size = '' THEN
      CONTINUE;
    END IF;

    SELECT committed_by_size
    INTO v_committed
    FROM product_catalog
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_committed := COALESCE(v_committed, '{}'::jsonb);
    
    v_newCommitted := v_committed || jsonb_build_object(
      v_size, COALESCE((v_committed->>v_size)::int, 0) + v_item.quantity
    );

    UPDATE product_catalog
    SET committed_by_size = v_newCommitted
    WHERE id = v_item.product_id;

    v_items_committed := v_items_committed || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_size,
      'quantity', v_item.quantity
    );
  END LOOP;

  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (p_live_cart_id, 'live_sale_committed', v_items_committed);

  UPDATE live_carts 
  SET stock_decremented_at = now() 
  WHERE id = p_live_cart_id;

  RETURN jsonb_build_object(
    'success', true,
    'live_cart_id', p_live_cart_id,
    'stock_committed', true,
    'items_count', jsonb_array_length(v_items_committed),
    'items', v_items_committed
  );
END;
$$;
