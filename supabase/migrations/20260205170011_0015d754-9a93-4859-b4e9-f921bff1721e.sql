-- TAREFA 1: Fix trigger recursion by adding pg_trigger_depth() guard
-- The issue: handle_order_paid fires when live_cart sync updates orders.status to 'pago'
-- This causes double stock processing and deep recursion

-- Fix the handle_order_paid trigger function to skip when triggered by sync
CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items_synced BOOLEAN;
  v_items_count INT;
  v_item RECORD;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement_exists BOOLEAN;
  v_items_array JSONB := '[]'::jsonb;
BEGIN
  -- CRITICAL GUARD 1: Skip if we're not the first trigger in the chain
  -- This prevents recursion when triggered indirectly by sync triggers
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- CRITICAL GUARD 2: Skip if being called from live_cart sync
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only process when order status changes TO 'pago'
  IF TG_OP = 'UPDATE' AND (OLD.status = 'pago' OR NEW.status != 'pago') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status != 'pago' THEN
    RETURN NEW;
  END IF;

  -- Skip if already processed
  IF NEW.stock_decremented_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- For live orders, stock is handled by apply_live_cart_paid_effects
  -- Just copy the flag if already processed on live_cart side
  IF NEW.source = 'live' AND NEW.live_cart_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM live_carts WHERE id = NEW.live_cart_id AND stock_decremented_at IS NOT NULL) THEN
      NEW.stock_decremented_at := (SELECT stock_decremented_at FROM live_carts WHERE id = NEW.live_cart_id);
      RETURN NEW;
    END IF;
    IF EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = NEW.live_cart_id AND movement_type IN ('live_sale_committed', 'live_sale_decrement')) THEN
      NEW.stock_decremented_at := now();
      RETURN NEW;
    END IF;
  END IF;

  -- Ensure order_items exist for live orders
  v_items_synced := ensure_order_items_for_live_order(NEW.id);
  SELECT COUNT(*) INTO v_items_count FROM order_items WHERE order_id = NEW.id;
  
  IF v_items_count = 0 THEN
    RAISE WARNING 'Order % marked as paid but has no items. Skipping stock decrement.', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Check idempotency - if movement exists, just mark as processed
  SELECT EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = NEW.id) INTO v_movement_exists;
  IF v_movement_exists THEN
    NEW.stock_decremented_at := now();
    RETURN NEW;
  END IF;
  
  -- Process each order item - commit stock
  FOR v_item IN SELECT oi.product_id, oi.size, oi.quantity FROM order_items oi WHERE oi.order_id = NEW.id
  LOOP
    v_size := v_item.size;
    v_qty := v_item.quantity;
    IF v_size IS NULL OR v_size = '' THEN CONTINUE; END IF;
    
    SELECT committed_by_size INTO v_current_committed FROM product_catalog WHERE id = v_item.product_id FOR UPDATE;
    IF FOUND THEN
      v_current_committed := COALESCE(v_current_committed, '{}'::jsonb);
      v_current_committed := jsonb_set(v_current_committed, ARRAY[v_size], to_jsonb(COALESCE((v_current_committed->>v_size)::int, 0) + v_qty));
      UPDATE product_catalog SET committed_by_size = v_current_committed WHERE id = v_item.product_id;
      v_items_array := v_items_array || jsonb_build_object('product_id', v_item.product_id, 'size', v_size, 'qty', v_qty);
    END IF;
  END LOOP;
  
  -- Insert movement if items were processed
  IF jsonb_array_length(v_items_array) > 0 THEN
    INSERT INTO inventory_movements (order_id, movement_type, items_json) 
    VALUES (NEW.id, 'sale_committed', v_items_array)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  
  NEW.stock_decremented_at := now();
  RETURN NEW;
END;
$$;

-- Also fix the trigger_apply_live_cart_paid_effects to be safer
CREATE OR REPLACE FUNCTION public.trigger_apply_live_cart_paid_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- GUARD: Skip if we're in a nested trigger (prevents recursion)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only trigger when status changes TO 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    -- Only call if not already processed
    IF NEW.stock_decremented_at IS NULL THEN
      PERFORM apply_live_cart_paid_effects(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;