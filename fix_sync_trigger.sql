-- ==============================================================================
-- FIX: Sync Live Carts to Orders (Step-by-Step Fix)
-- 
-- SAFETY NOTICE: These scripts only affect how Live Carts are mirrored to the 
-- general orders list. They DO NOT touch your product catalog or prices.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- BLOCK 1: Helper function to sync order items
-- Run this block FIRST.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_order_items_for_live_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live_cart_id uuid;
  v_items_created integer := 0;
  v_item RECORD;
BEGIN
  SELECT live_cart_id INTO v_live_cart_id FROM orders WHERE id = p_order_id;
  IF v_live_cart_id IS NULL THEN RETURN false; END IF;
  
  DELETE FROM order_items WHERE order_id = p_order_id;
  
  FOR v_item IN
    SELECT lci.product_id, lci.variante->>'tamanho' as size, lci.variante->>'cor' as color,
           lci.qtd as quantity, lci.preco_unitario as price, p.name as product_name,
           p.sku as product_sku, p.image_url as image_url
    FROM live_cart_items lci
    JOIN product_catalog p ON p.id = lci.product_id
    WHERE lci.live_cart_id = v_live_cart_id AND lci.status IN ('reservado', 'confirmado')
  LOOP
    INSERT INTO order_items (order_id, product_id, product_name, product_sku, product_price, size, color, quantity, image_url)
    VALUES (p_order_id, v_item.product_id, COALESCE(v_item.product_name, 'Produto'), v_item.product_sku, v_item.price, COALESCE(v_item.size, ''), v_item.color, v_item.quantity, v_item.image_url);
    v_items_created := v_items_created + 1;
  END LOOP;
  RETURN v_items_created > 0;
END;
$$;


-- ------------------------------------------------------------------------------
-- BLOCK 2: Main sync function and trigger
-- Run this block SECOND.
-- ------------------------------------------------------------------------------
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
  IF current_setting('app.syncing_order', true) = 'true' THEN RETURN NEW; END IF;

  PERFORM set_config('app.syncing_live_cart', 'true', true);

  BEGIN
    SELECT * INTO v_live_customer FROM live_customers WHERE id = NEW.live_customer_id;
    SELECT * INTO v_live_event FROM live_events WHERE id = NEW.live_event_id;

    v_order_status := CASE 
      WHEN NEW.operational_status = 'aguardando_validacao_pagamento' THEN 'aguardando_validacao_pagamento'
      ELSE CASE NEW.status::text
        WHEN 'pago' THEN 'pago'
        WHEN 'cancelado' THEN 'cancelado'
        WHEN 'expirado' THEN 'cancelado'
        ELSE 'aguardando_pagamento'
      END
    END;

    v_customer_name := COALESCE(v_live_customer.nome, v_live_customer.instagram_handle, 'Cliente Live');
    v_customer_phone := COALESCE(v_live_customer.whatsapp, '');

    SELECT id INTO v_order_id FROM orders WHERE live_cart_id = NEW.id;

    IF v_order_id IS NOT NULL THEN
      UPDATE orders SET
        status = v_order_status, paid_at = NEW.paid_at, gateway = COALESCE(NEW.paid_method, gateway),
        tracking_code = COALESCE(NEW.shipping_tracking_code, tracking_code), me_label_url = COALESCE(NEW.me_label_url, me_label_url),
        total = NEW.total, subtotal = NEW.subtotal, shipping_fee = NEW.frete, coupon_discount = NEW.descontos,
        payment_proof_url = COALESCE(NEW.payment_proof_url, payment_proof_url), payment_review_status = COALESCE(NEW.payment_review_status, payment_review_status),
        delivery_method = COALESCE(NEW.delivery_method, delivery_method), address_snapshot = COALESCE(NEW.shipping_address_snapshot, address_snapshot),
        user_id = COALESCE(NEW.user_id, user_id),
        customer_name = COALESCE(NULLIF(v_customer_name, 'Cliente Live'), customer_name),
        customer_phone = CASE WHEN v_customer_phone != '' THEN v_customer_phone ELSE customer_phone END,
        updated_at = now()
      WHERE id = v_order_id;
      PERFORM ensure_order_items_for_live_order(v_order_id);
    ELSE
      IF NEW.status::text NOT IN ('cancelado', 'expirado') THEN
        IF v_live_customer.client_id IS NOT NULL THEN
          v_customer_id := v_live_customer.client_id;
        ELSE
          SELECT id INTO v_customer_id FROM customers WHERE (phone = v_live_customer.whatsapp AND v_live_customer.whatsapp IS NOT NULL) OR (instagram_handle = v_live_customer.instagram_handle AND v_live_customer.instagram_handle IS NOT NULL) LIMIT 1;
          IF v_customer_id IS NULL AND v_live_customer.whatsapp IS NOT NULL THEN
            INSERT INTO customers (phone, name, instagram_handle) VALUES (v_live_customer.whatsapp, v_live_customer.nome, v_live_customer.instagram_handle) RETURNING id INTO v_customer_id;
          END IF;
        END IF;

        INSERT INTO orders (customer_id, customer_name, customer_phone, status, total, subtotal, shipping_fee, coupon_discount, source, live_cart_id, live_event_id, live_bag_number, paid_at, gateway, delivery_method, address_snapshot, user_id, reserved_until, payment_proof_url, payment_review_status)
        VALUES (v_customer_id, v_customer_name, v_customer_phone, v_order_status, NEW.total, NEW.subtotal, NEW.frete, NEW.descontos, 'live', NEW.id, NEW.live_event_id, NEW.bag_number, NEW.paid_at, NEW.paid_method, NEW.delivery_method, NEW.shipping_address_snapshot, NEW.user_id, now() + (COALESCE(v_live_event.reservation_expiry_minutes, 10080) || ' minutes')::interval, NEW.payment_proof_url, NEW.payment_review_status)
        RETURNING id INTO v_order_id;

        UPDATE live_carts SET order_id = v_order_id WHERE id = NEW.id;
        PERFORM ensure_order_items_for_live_order(v_order_id);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[sync_trigger] ERROR for cart %: %', NEW.id, SQLERRM;
  END;

  PERFORM set_config('app.syncing_live_cart', 'false', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_live_cart_sync_to_orders ON public.live_carts;
CREATE TRIGGER on_live_cart_sync_to_orders AFTER INSERT OR UPDATE ON public.live_carts FOR EACH ROW EXECUTE FUNCTION trigger_sync_live_cart_to_orders();


-- ------------------------------------------------------------------------------
-- BLOCK 3: Backfill missing orders (Optional)
-- Run this only if you have existing carts that don't show up in orders.
-- ------------------------------------------------------------------------------
-- DO $$
-- DECLARE
--   v_cart RECORD;
--   v_customer_id uuid;
--   v_order_id uuid;
--   v_order_status text;
--   v_count int := 0;
-- BEGIN
--   FOR v_cart IN SELECT lc.*, lcust.nome, lcust.instagram_handle, lcust.whatsapp, lcust.client_id FROM live_carts lc JOIN live_customers lcust ON lcust.id = lc.live_customer_id WHERE lc.order_id IS NULL AND lc.status NOT IN ('cancelado', 'expirado') LOOP
--     v_order_status := CASE v_cart.status::text WHEN 'pago' THEN 'pago' ELSE 'aguardando_pagamento' END;
--     v_customer_id := v_cart.client_id;
--     IF v_customer_id IS NULL THEN
--       SELECT id INTO v_customer_id FROM customers WHERE (phone = v_cart.whatsapp AND v_cart.whatsapp IS NOT NULL) OR (instagram_handle = v_cart.instagram_handle AND v_cart.instagram_handle IS NOT NULL) LIMIT 1;
--     END IF;
--     INSERT INTO orders (customer_id, customer_name, customer_phone, status, total, subtotal, shipping_fee, coupon_discount, source, live_cart_id, live_event_id, live_bag_number, paid_at, gateway, delivery_method, address_snapshot, user_id, reserved_until)
--     VALUES (v_customer_id, COALESCE(v_cart.nome, v_cart.instagram_handle, 'Cliente Live'), COALESCE(v_cart.whatsapp, ''), v_order_status, v_cart.total, v_cart.subtotal, v_cart.frete, v_cart.descontos, 'live', v_cart.id, v_cart.live_event_id, v_cart.bag_number, v_cart.paid_at, v_cart.paid_method, v_cart.delivery_method, v_cart.shipping_address_snapshot, v_cart.user_id, now() + interval '7 days') RETURNING id INTO v_order_id;
--     UPDATE live_carts SET order_id = v_order_id WHERE id = v_cart.id;
--     PERFORM ensure_order_items_for_live_order(v_order_id);
--     v_count := v_count + 1;
--   END LOOP;
--   RAISE NOTICE 'Backfilled % orders', v_count;
-- END;
-- $$;
