-- ============================================
-- FIX: Eliminate infinite trigger recursion between live_carts and orders
-- Implements 3 protections: session flags, idempotent updates, source separation
-- ============================================

-- 1. Drop existing problematic triggers first
DROP TRIGGER IF EXISTS on_live_cart_sync_to_orders ON live_carts;
DROP TRIGGER IF EXISTS on_order_sync_to_live_cart ON orders;
DROP TRIGGER IF EXISTS trigger_sync_live_cart_status ON live_carts;
DROP TRIGGER IF EXISTS trigger_sync_order_status ON orders;

-- 2. Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS trigger_sync_live_cart_to_orders() CASCADE;
DROP FUNCTION IF EXISTS trigger_sync_order_to_live_cart() CASCADE;

-- ============================================
-- FUNCTION: sync_live_cart_to_order (called by trigger, NOT directly)
-- Syncs live_carts changes TO orders table
-- ============================================
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
BEGIN
  -- PROTECTION 1: Session flag to prevent re-entry (ping-pong)
  -- If we're already syncing FROM orders, don't sync back
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
    v_order_status := CASE NEW.status
      WHEN 'aberto' THEN 'pendente'
      WHEN 'em_confirmacao' THEN 'aguardando_pagamento'
      WHEN 'aguardando_pagamento' THEN 'aguardando_pagamento'
      WHEN 'pago' THEN 'pago'
      WHEN 'cancelado' THEN 'cancelado'
      WHEN 'expirado' THEN 'cancelado'
      ELSE 'pendente'
    END;

    -- Check if order exists
    SELECT id INTO v_order_id
    FROM orders
    WHERE live_cart_id = NEW.id;

    IF v_order_id IS NOT NULL THEN
      -- PROTECTION 2: Idempotent update - only update if values actually changed
      UPDATE orders SET
        status = v_order_status,
        paid_at = NEW.paid_at,
        paid_method = NEW.paid_method,
        tracking_code = COALESCE(NEW.shipping_tracking_code, tracking_code),
        me_label_url = COALESCE(NEW.me_label_url, me_label_url),
        me_shipment_id = COALESCE(NEW.me_shipment_id, me_shipment_id),
        total = NEW.total,
        subtotal = NEW.subtotal,
        shipping_cost = NEW.frete,
        discount = NEW.descontos,
        updated_at = now()
      WHERE id = v_order_id
        AND (
          status IS DISTINCT FROM v_order_status
          OR paid_at IS DISTINCT FROM NEW.paid_at
          OR paid_method IS DISTINCT FROM NEW.paid_method
          OR tracking_code IS DISTINCT FROM COALESCE(NEW.shipping_tracking_code, tracking_code)
          OR me_label_url IS DISTINCT FROM COALESCE(NEW.me_label_url, me_label_url)
          OR total IS DISTINCT FROM NEW.total
        );
    ELSE
      -- Only create order for confirmed/paid carts
      IF NEW.status IN ('em_confirmacao', 'aguardando_pagamento', 'pago') THEN
        -- Find or create customer
        IF v_live_customer.client_id IS NOT NULL THEN
          v_customer_id := v_live_customer.client_id;
        ELSE
          -- Try to find by phone/instagram
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

        -- Create order
        INSERT INTO orders (
          customer_id,
          status,
          total,
          subtotal,
          shipping_cost,
          discount,
          source,
          live_cart_id,
          live_id,
          live_bag_number,
          paid_at,
          paid_method,
          delivery_method,
          tracking_code,
          me_label_url,
          me_shipment_id,
          reserved_until
        ) VALUES (
          v_customer_id,
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
    -- Log error but don't fail the transaction
    RAISE WARNING 'trigger_sync_live_cart_to_orders error: %', SQLERRM;
  END;

  -- Clear the flag
  PERFORM set_config('app.syncing_live_cart', 'false', true);

  RETURN NEW;
END;
$$;

-- ============================================
-- FUNCTION: sync_order_to_live_cart
-- Syncs orders changes BACK to live_carts (only logistics fields)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_sync_order_to_live_cart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- PROTECTION 1: Session flag to prevent re-entry
  -- If we're already syncing FROM live_carts, don't sync back
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- PROTECTION 3: Only sync for live orders that have a live_cart_id
  IF NEW.source != 'live' OR NEW.live_cart_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only process relevant field changes (logistics only, NOT status)
  IF TG_OP = 'UPDATE' 
     AND OLD.tracking_code IS NOT DISTINCT FROM NEW.tracking_code
     AND OLD.me_label_url IS NOT DISTINCT FROM NEW.me_label_url
     AND OLD.me_shipment_id IS NOT DISTINCT FROM NEW.me_shipment_id THEN
    RETURN NEW;
  END IF;

  -- Set flag to prevent live_cart trigger from calling us back
  PERFORM set_config('app.syncing_order', 'true', true);

  BEGIN
    -- PROTECTION 2 & 3: Idempotent update of ONLY logistics fields
    -- DO NOT sync status back - live_carts.status is the source of truth for live orders
    UPDATE live_carts SET
      shipping_tracking_code = COALESCE(NEW.tracking_code, shipping_tracking_code),
      me_label_url = COALESCE(NEW.me_label_url, me_label_url),
      me_shipment_id = COALESCE(NEW.me_shipment_id, me_shipment_id),
      updated_at = now()
    WHERE id = NEW.live_cart_id
      AND (
        shipping_tracking_code IS DISTINCT FROM COALESCE(NEW.tracking_code, shipping_tracking_code)
        OR me_label_url IS DISTINCT FROM COALESCE(NEW.me_label_url, me_label_url)
        OR me_shipment_id IS DISTINCT FROM COALESCE(NEW.me_shipment_id, me_shipment_id)
      );

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_sync_order_to_live_cart error: %', SQLERRM;
  END;

  -- Clear the flag
  PERFORM set_config('app.syncing_order', 'false', true);

  RETURN NEW;
END;
$$;

-- ============================================
-- RECREATE TRIGGERS
-- ============================================

-- Trigger on live_carts to sync TO orders
CREATE TRIGGER on_live_cart_sync_to_orders
  AFTER INSERT OR UPDATE ON live_carts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_live_cart_to_orders();

-- Trigger on orders to sync logistics BACK to live_carts (NOT status)
CREATE TRIGGER on_order_sync_to_live_cart
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.source = 'live' AND NEW.live_cart_id IS NOT NULL)
  EXECUTE FUNCTION trigger_sync_order_to_live_cart();

-- ============================================
-- SANITY CHECK: Verify no other conflicting triggers exist
-- ============================================
DO $$
DECLARE
  trigger_count int;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table IN ('live_carts', 'orders')
    AND trigger_name LIKE '%sync%'
    AND trigger_name NOT IN ('on_live_cart_sync_to_orders', 'on_order_sync_to_live_cart');
  
  IF trigger_count > 0 THEN
    RAISE WARNING 'Found % other sync triggers that might cause conflicts', trigger_count;
  END IF;
END;
$$;