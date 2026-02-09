
-- PARTE 1: Corrigir apenas sync_live_cart_to_order (trigger) com enums válidos
CREATE OR REPLACE FUNCTION public.sync_live_cart_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_customer RECORD;
  v_order_status text;
  v_address_snapshot jsonb;
  v_full_address text;
BEGIN
  -- Only sync for valid statuses
  IF NEW.status::text NOT IN ('aguardando_pagamento', 'pago', 'cancelado', 'expirado') THEN
    RETURN NEW;
  END IF;
  
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
  
  PERFORM ensure_order_items_for_live_order(v_order_id);
  
  RETURN NEW;
END;
$function$;
