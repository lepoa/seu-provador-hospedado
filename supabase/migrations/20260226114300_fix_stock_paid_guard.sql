-- =======================================================
-- FIX: apply_paid_effects skips stock when order is created as 'pago'
-- =======================================================
-- PROBLEM: The mp-webhook creates orders with status='pago' directly.
-- Then calls apply_paid_effects, which checks 'IF status = pago AND payment_status = approved'
-- and returns 'already_paid' → skipping stock decrement entirely.
--
-- SOLUTION: Change the guard to check stock_decremented_at IS NOT NULL instead.
-- This allows processing even when order is already 'pago', as long as stock
-- hasn't been decremented yet. The movement idempotency check still prevents double-processing.
-- =======================================================

CREATE OR REPLACE FUNCTION public.apply_paid_effects(
  p_order_id uuid, 
  p_confirmed_amount numeric DEFAULT NULL, 
  p_paid_at timestamptz DEFAULT NULL, 
  p_gateway text DEFAULT 'mercado_pago'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_committed JSONB;
  v_newCommitted JSONB;
  v_size TEXT;
  v_movement_exists BOOLEAN;
  v_items_committed JSONB := '[]'::jsonb;
  v_actual_paid_at TIMESTAMPTZ;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- FIX: Check stock_decremented_at instead of status.
  -- This allows processing when order is created already as 'pago' (webhook flow)
  -- but still prevents double-processing.
  IF v_order.stock_decremented_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_paid', true,
      'order_id', p_order_id,
      'message', 'Stock already decremented at ' || v_order.stock_decremented_at::text
    );
  END IF;

  v_actual_paid_at := COALESCE(p_paid_at, now());

  -- Update order to PAGO
  UPDATE orders
  SET 
    status = 'pago',
    payment_status = 'approved',
    payment_confirmed_amount = COALESCE(p_confirmed_amount, total),
    paid_at = v_actual_paid_at,
    gateway = p_gateway,
    stock_decremented_at = now(), -- Mark as processed
    updated_at = now()
  WHERE id = p_order_id;

  -- Check if stock already decremented (idempotent)
  SELECT EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = p_order_id) 
  INTO v_movement_exists;

  IF v_movement_exists THEN
    RETURN jsonb_build_object(
      'success', true, 
      'stock_decremented', false,
      'reason', 'Movement already exists (idempotent)',
      'order_id', p_order_id
    );
  END IF;

  -- Add to committed_by_size ONLY (do NOT modify stock_by_size)
  FOR v_item IN
    SELECT product_id, size, quantity
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    v_size := v_item.size;
    IF v_size IS NULL OR v_size = '' THEN
      CONTINUE;
    END IF;

    -- Get current committed
    SELECT committed_by_size
    INTO v_committed
    FROM product_catalog
    WHERE id = v_item.product_id
    FOR UPDATE; -- Lock row

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_committed := COALESCE(v_committed, '{}'::jsonb);
    
    -- Increment committed for this size
    v_newCommitted := v_committed || jsonb_build_object(
      v_size, COALESCE((v_committed->>v_size)::int, 0) + v_item.quantity
    );

    -- ONLY update committed_by_size, NOT stock_by_size
    UPDATE product_catalog
    SET committed_by_size = v_newCommitted
    WHERE id = v_item.product_id;

    -- Track what was committed
    v_items_committed := v_items_committed || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_size,
      'quantity', v_item.quantity
    );
  END LOOP;

  -- Record the movement (ensures idempotency)
  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (p_order_id, 'sale_committed', v_items_committed);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'stock_committed', true,
    'items', v_items_committed
  );
END;
$$;
