-- FIX: Add recursion guards to prevent infinite trigger loops between live_carts and orders

-- 1) Drop the problematic triggers first
DROP TRIGGER IF EXISTS on_live_cart_sync_to_orders ON public.live_carts;
DROP TRIGGER IF EXISTS on_order_sync_to_live_cart ON public.orders;

-- 2) Recreate trigger_sync_live_cart_to_orders with recursion guard
CREATE OR REPLACE FUNCTION public.trigger_sync_live_cart_to_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- RECURSION GUARD: Skip if we're already syncing
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only sync for meaningful status changes
  IF NEW.status IN ('aguardando_pagamento', 'pago', 'cancelado', 'expirado') 
     OR (NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago')
     OR (NEW.operational_status IS DISTINCT FROM OLD.operational_status AND NEW.status = 'pago') THEN
    
    -- Set guard before syncing
    PERFORM set_config('app.syncing_live_cart', 'true', true);
    PERFORM sync_live_cart_to_orders(NEW.id);
    PERFORM set_config('app.syncing_live_cart', 'false', true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Recreate trigger_sync_order_to_live_cart with recursion guard
CREATE OR REPLACE FUNCTION public.trigger_sync_order_to_live_cart()
RETURNS TRIGGER AS $$
BEGIN
  -- RECURSION GUARD: Skip if we're already syncing
  IF current_setting('app.syncing_order', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only sync if this is a live order and relevant fields changed
  IF NEW.live_cart_id IS NOT NULL AND (
    NEW.tracking_code IS DISTINCT FROM OLD.tracking_code OR
    NEW.me_shipment_id IS DISTINCT FROM OLD.me_shipment_id OR
    NEW.me_label_url IS DISTINCT FROM OLD.me_label_url OR
    NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    -- Set guard before syncing
    PERFORM set_config('app.syncing_order', 'true', true);
    PERFORM sync_order_to_live_cart(NEW.id);
    PERFORM set_config('app.syncing_order', 'false', true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4) Update sync_live_cart_to_order to also check the guard flag
CREATE OR REPLACE FUNCTION public.sync_live_cart_to_order()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_customer RECORD;
  v_order_status text;
  v_address_snapshot jsonb;
  v_full_address text;
BEGIN
  -- RECURSION GUARD: Skip if we're already syncing from orders
  IF current_setting('app.syncing_order', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only sync for valid statuses
  IF NEW.status::text NOT IN ('aguardando_pagamento', 'pago', 'cancelado', 'expirado') THEN
    RETURN NEW;
  END IF;
  
  -- Set guard to prevent reverse sync
  PERFORM set_config('app.syncing_live_cart', 'true', true);
  
  SELECT * INTO v_customer FROM live_customers WHERE id = NEW.live_customer_id;
  
  v_order_status := CASE NEW.status::text
    WHEN 'pago' THEN 
      CASE NEW.operational_status
        WHEN 'postado' THEN 'enviado'
        WHEN 'em_rota' THEN 'enviado'
        WHEN 'etiqueta_gerada' THEN 'etiqueta_gerada'
        WHEN 'entregue' THEN 'entregue'
        WHEN 'retirado' THEN 'entregue'
        ELSE 'pago'
      END
    WHEN 'cancelado' THEN 'cancelado'
    WHEN 'expirado' THEN 'cancelado'
    ELSE 'aguardando_pagamento'
  END;
  
  v_address_snapshot := COALESCE(NEW.shipping_address_snapshot, '{}'::jsonb);
  v_full_address := COALESCE(v_address_snapshot->>'street', v_address_snapshot->>'address_line', '');
  IF v_address_snapshot->>'number' IS NOT NULL THEN
    v_full_address := v_full_address || ', ' || (v_address_snapshot->>'number');
  END IF;
  IF v_address_snapshot->>'neighborhood' IS NOT NULL THEN
    v_full_address := v_full_address || ' - ' || (v_address_snapshot->>'neighborhood');
  END IF;
  IF v_address_snapshot->>'city' IS NOT NULL THEN
    v_full_address := v_full_address || ', ' || (v_address_snapshot->>'city');
  END IF;
  IF v_address_snapshot->>'state' IS NOT NULL THEN
    v_full_address := v_full_address || ' - ' || (v_address_snapshot->>'state');
  END IF;
  
  INSERT INTO orders (
    id, source, live_cart_id, live_event_id, live_bag_number,
    customer_name, customer_phone, customer_address, address_snapshot,
    subtotal, shipping_fee, total, status, payment_status, gateway, paid_at,
    tracking_code, me_shipment_id, me_label_url,
    delivery_method, delivery_period, delivery_notes, seller_id, coupon_id, coupon_discount,
    stock_decremented_at, created_at, updated_at
  )
  VALUES (
    COALESCE(NEW.order_id, gen_random_uuid()),
    'live', NEW.id, NEW.live_event_id, NEW.bag_number,
    COALESCE(v_customer.nome, v_customer.instagram_handle, 'Cliente'),
    COALESCE(v_customer.whatsapp, ''),
    COALESCE(v_full_address, ''),
    v_address_snapshot,
    NEW.subtotal, NEW.frete, NEW.total, v_order_status,
    CASE NEW.status::text WHEN 'pago' THEN 'approved' ELSE 'pending' END,
    NEW.paid_method, NEW.paid_at,
    NEW.shipping_tracking_code, NEW.me_shipment_id, NEW.me_label_url,
    NEW.delivery_method, NEW.delivery_period, NEW.delivery_notes, NEW.seller_id, NEW.coupon_id, NEW.coupon_discount,
    NEW.stock_decremented_at, NEW.created_at, now()
  )
  ON CONFLICT (live_cart_id) WHERE live_cart_id IS NOT NULL
  DO UPDATE SET
    live_bag_number = EXCLUDED.live_bag_number,
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    customer_address = EXCLUDED.customer_address,
    address_snapshot = COALESCE(EXCLUDED.address_snapshot, orders.address_snapshot),
    subtotal = EXCLUDED.subtotal,
    shipping_fee = EXCLUDED.shipping_fee,
    total = EXCLUDED.total,
    status = EXCLUDED.status,
    payment_status = EXCLUDED.payment_status,
    gateway = COALESCE(EXCLUDED.gateway, orders.gateway),
    paid_at = COALESCE(EXCLUDED.paid_at, orders.paid_at),
    tracking_code = COALESCE(EXCLUDED.tracking_code, orders.tracking_code),
    me_shipment_id = COALESCE(EXCLUDED.me_shipment_id, orders.me_shipment_id),
    me_label_url = COALESCE(EXCLUDED.me_label_url, orders.me_label_url),
    delivery_method = COALESCE(EXCLUDED.delivery_method, orders.delivery_method),
    seller_id = COALESCE(EXCLUDED.seller_id, orders.seller_id),
    stock_decremented_at = COALESCE(orders.stock_decremented_at, EXCLUDED.stock_decremented_at),
    updated_at = now()
  RETURNING id INTO v_order_id;
  
  IF NEW.order_id IS NULL THEN
    NEW.order_id := v_order_id;
  END IF;
  
  -- Ensure items are synced
  PERFORM ensure_order_items_for_live_order(v_order_id);
  
  -- Reset guard
  PERFORM set_config('app.syncing_live_cart', 'false', true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5) Update sync_order_to_live_cart to also use recursion guards
CREATE OR REPLACE FUNCTION public.sync_order_to_live_cart(p_order_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- RECURSION GUARD: Skip if we're already syncing from live_carts
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'recursion guard active');
  END IF;

  -- Get order with live cart reference
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND live_cart_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not a live order');
  END IF;

  -- Set guard to prevent reverse sync
  PERFORM set_config('app.syncing_order', 'true', true);

  -- Sync tracking info and operational status back to live_cart
  UPDATE live_carts SET
    shipping_tracking_code = COALESCE(v_order.tracking_code, shipping_tracking_code),
    me_shipment_id = COALESCE(v_order.me_shipment_id, me_shipment_id),
    me_label_url = COALESCE(v_order.me_label_url, me_label_url),
    operational_status = CASE v_order.status
      WHEN 'etiqueta_gerada' THEN 'etiqueta_gerada'
      WHEN 'enviado' THEN 'postado'
      WHEN 'entregue' THEN 'entregue'
      WHEN 'cancelado' THEN 'cancelado'
      ELSE operational_status
    END,
    updated_at = now()
  WHERE id = v_order.live_cart_id;

  -- Reset guard
  PERFORM set_config('app.syncing_order', 'false', true);

  RETURN jsonb_build_object('success', true, 'live_cart_id', v_order.live_cart_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6) Recreate triggers with explicit execution order
CREATE TRIGGER on_live_cart_sync_to_orders
  AFTER UPDATE ON public.live_carts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_live_cart_to_orders();

CREATE TRIGGER on_order_sync_to_live_cart
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_order_to_live_cart();