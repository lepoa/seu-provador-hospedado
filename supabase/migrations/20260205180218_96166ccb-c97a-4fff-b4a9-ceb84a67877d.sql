-- ============================================
-- FIX: Create orders for ALL live_carts statuses (not just confirmed/paid)
-- This ensures bags appear in Admin > Pedidos immediately upon creation
-- ============================================

-- Drop and recreate the sync function with corrected logic
CREATE OR REPLACE FUNCTION trigger_sync_live_cart_to_orders()
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
  v_customer_name text;
  v_customer_phone text;
BEGIN
  -- PROTECTION 1: Session flag to prevent re-entry (ping-pong)
  IF current_setting('app.syncing_order', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only process relevant status changes
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status 
     AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at
     AND OLD.paid_method IS NOT DISTINCT FROM NEW.paid_method
     AND OLD.delivery_method IS NOT DISTINCT FROM NEW.delivery_method
     AND OLD.shipping_tracking_code IS NOT DISTINCT FROM NEW.shipping_tracking_code
     AND OLD.me_label_url IS NOT DISTINCT FROM NEW.me_label_url
     AND OLD.total IS NOT DISTINCT FROM NEW.total THEN
    RETURN NEW;
  END IF;

  -- Set flag to prevent order trigger from calling us back
  PERFORM set_config('app.syncing_live_cart', 'true', true);

  BEGIN
    -- Get live customer info
    SELECT * INTO v_live_customer 
    FROM live_customers 
    WHERE id = NEW.live_customer_id;

    -- Get live event info
    SELECT * INTO v_live_event
    FROM live_events
    WHERE id = NEW.live_event_id;

    -- Map live_cart status to order status
    -- CRITICAL FIX: 'aberto' maps to 'aguardando_pagamento' so it appears in Admin
    v_order_status := CASE NEW.status::text
      WHEN 'aberto' THEN 'aguardando_pagamento'
      WHEN 'em_confirmacao' THEN 'aguardando_pagamento'
      WHEN 'aguardando_pagamento' THEN 'aguardando_pagamento'
      WHEN 'pago' THEN 'pago'
      WHEN 'cancelado' THEN 'cancelado'
      WHEN 'expirado' THEN 'cancelado'
      ELSE 'aguardando_pagamento'
    END;

    -- Build customer name and phone
    v_customer_name := COALESCE(v_live_customer.nome, v_live_customer.instagram_handle, 'Cliente Live');
    v_customer_phone := COALESCE(v_live_customer.whatsapp, '');

    -- Check if order exists
    SELECT id INTO v_order_id
    FROM orders
    WHERE live_cart_id = NEW.id;

    IF v_order_id IS NOT NULL THEN
      -- Update existing order
      UPDATE orders SET
        status = v_order_status,
        paid_at = NEW.paid_at,
        gateway = COALESCE(NEW.paid_method, gateway),
        tracking_code = COALESCE(NEW.shipping_tracking_code, tracking_code),
        me_label_url = COALESCE(NEW.me_label_url, me_label_url),
        me_shipment_id = COALESCE(NEW.me_shipment_id, me_shipment_id),
        total = NEW.total,
        subtotal = NEW.subtotal,
        shipping_fee = NEW.frete,
        coupon_discount = NEW.descontos,
        updated_at = now()
      WHERE id = v_order_id
        AND (
          status IS DISTINCT FROM v_order_status
          OR paid_at IS DISTINCT FROM NEW.paid_at
          OR tracking_code IS DISTINCT FROM COALESCE(NEW.shipping_tracking_code, tracking_code)
          OR me_label_url IS DISTINCT FROM COALESCE(NEW.me_label_url, me_label_url)
          OR total IS DISTINCT FROM NEW.total
        );
    ELSE
      -- CRITICAL FIX: Create order for ALL statuses except cancelled/expired
      -- This ensures bags appear in Admin > Pedidos immediately upon creation
      IF NEW.status::text NOT IN ('cancelado', 'expirado') THEN
        -- Find or create customer
        IF v_live_customer.client_id IS NOT NULL THEN
          v_customer_id := v_live_customer.client_id;
        ELSE
          SELECT id INTO v_customer_id
          FROM customers
          WHERE (phone = v_live_customer.whatsapp AND v_live_customer.whatsapp IS NOT NULL)
             OR (instagram_handle = v_live_customer.instagram_handle AND v_live_customer.instagram_handle IS NOT NULL)
          LIMIT 1;

          IF v_customer_id IS NULL AND v_live_customer.whatsapp IS NOT NULL THEN
            INSERT INTO customers (phone, name, instagram_handle)
            VALUES (v_live_customer.whatsapp, v_live_customer.nome, v_live_customer.instagram_handle)
            RETURNING id INTO v_customer_id;
          END IF;
        END IF;

        -- Create order with 7-day reservation for live orders
        INSERT INTO orders (
          customer_id,
          customer_name,
          customer_phone,
          customer_address,
          status,
          total,
          subtotal,
          shipping_fee,
          coupon_discount,
          source,
          live_cart_id,
          live_event_id,
          live_bag_number,
          paid_at,
          gateway,
          delivery_method,
          tracking_code,
          me_label_url,
          me_shipment_id,
          reserved_until
        ) VALUES (
          v_customer_id,
          v_customer_name,
          v_customer_phone,
          '',
          v_order_status,
          NEW.total,
          NEW.subtotal,
          NEW.frete,
          NEW.descontos,
          'live',
          NEW.id,
          NEW.live_event_id,
          NEW.bag_number,
          NEW.paid_at,
          NEW.paid_method,
          NEW.delivery_method,
          NEW.shipping_tracking_code,
          NEW.me_label_url,
          NEW.me_shipment_id,
          now() + (COALESCE(v_live_event.reservation_expiry_minutes, 10080) || ' minutes')::interval
        )
        RETURNING id INTO v_order_id;

        -- Update live_cart with order_id reference
        UPDATE live_carts SET order_id = v_order_id WHERE id = NEW.id;

        -- Ensure order items are synced
        PERFORM ensure_order_items_for_live_order(v_order_id);
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_sync_live_cart_to_orders error: %', SQLERRM;
  END;

  -- Clear the flag
  PERFORM set_config('app.syncing_live_cart', 'false', true);

  RETURN NEW;
END;
$$;

-- ============================================
-- BACKFILL: Create orders for existing live_carts that don't have orders yet
-- ============================================
DO $$
DECLARE
  v_cart RECORD;
  v_order_id uuid;
  v_customer_id uuid;
  v_live_customer RECORD;
  v_live_event RECORD;
  v_order_status text;
  v_customer_name text;
  v_customer_phone text;
  v_count int := 0;
BEGIN
  FOR v_cart IN 
    SELECT lc.* 
    FROM live_carts lc
    LEFT JOIN orders o ON o.live_cart_id = lc.id
    WHERE o.id IS NULL 
      AND lc.status::text NOT IN ('cancelado', 'expirado')
  LOOP
    -- Get live customer info
    SELECT * INTO v_live_customer 
    FROM live_customers 
    WHERE id = v_cart.live_customer_id;

    -- Get live event info
    SELECT * INTO v_live_event
    FROM live_events
    WHERE id = v_cart.live_event_id;

    -- Map status
    v_order_status := CASE v_cart.status::text
      WHEN 'aberto' THEN 'aguardando_pagamento'
      WHEN 'em_confirmacao' THEN 'aguardando_pagamento'
      WHEN 'aguardando_pagamento' THEN 'aguardando_pagamento'
      WHEN 'pago' THEN 'pago'
      ELSE 'aguardando_pagamento'
    END;

    -- Build customer info
    v_customer_name := COALESCE(v_live_customer.nome, v_live_customer.instagram_handle, 'Cliente Live');
    v_customer_phone := COALESCE(v_live_customer.whatsapp, '');

    -- Find customer
    IF v_live_customer.client_id IS NOT NULL THEN
      v_customer_id := v_live_customer.client_id;
    ELSE
      SELECT id INTO v_customer_id
      FROM customers
      WHERE (phone = v_live_customer.whatsapp AND v_live_customer.whatsapp IS NOT NULL)
         OR (instagram_handle = v_live_customer.instagram_handle AND v_live_customer.instagram_handle IS NOT NULL)
      LIMIT 1;
    END IF;

    -- Create order
    INSERT INTO orders (
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      status,
      total,
      subtotal,
      shipping_fee,
      coupon_discount,
      source,
      live_cart_id,
      live_event_id,
      live_bag_number,
      paid_at,
      gateway,
      delivery_method,
      tracking_code,
      me_label_url,
      me_shipment_id,
      reserved_until,
      created_at
    ) VALUES (
      v_customer_id,
      v_customer_name,
      v_customer_phone,
      '',
      v_order_status,
      v_cart.total,
      v_cart.subtotal,
      v_cart.frete,
      v_cart.descontos,
      'live',
      v_cart.id,
      v_cart.live_event_id,
      v_cart.bag_number,
      v_cart.paid_at,
      v_cart.paid_method,
      v_cart.delivery_method,
      v_cart.shipping_tracking_code,
      v_cart.me_label_url,
      v_cart.me_shipment_id,
      COALESCE(v_cart.created_at + (COALESCE(v_live_event.reservation_expiry_minutes, 10080) || ' minutes')::interval, now() + interval '7 days'),
      v_cart.created_at
    )
    RETURNING id INTO v_order_id;

    -- Update live_cart with order_id reference
    UPDATE live_carts SET order_id = v_order_id WHERE id = v_cart.id;

    -- Ensure order items are synced
    PERFORM ensure_order_items_for_live_order(v_order_id);

    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfilled % orders for existing live_carts', v_count;
END;
$$;