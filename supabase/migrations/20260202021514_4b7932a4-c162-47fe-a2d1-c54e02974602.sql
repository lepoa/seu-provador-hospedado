-- Remove triggers we created that can double-decrement stock (keep existing ones)
DROP TRIGGER IF EXISTS orders_apply_paid_effects_on_paid ON public.orders;
DROP TRIGGER IF EXISTS live_carts_apply_paid_effects_on_paid ON public.live_carts;

-- Restore apply_paid_effects() to its prior behavior (avoid conflicting with existing decrement triggers)
CREATE OR REPLACE FUNCTION public.apply_paid_effects(p_order_id uuid, p_confirmed_amount numeric DEFAULT NULL::numeric, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_gateway text DEFAULT 'mercado_pago'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_product RECORD;
  v_erpStock JSONB;
  v_committed JSONB;
  v_newCommitted JSONB;
  v_newDisplayStock JSONB;
  v_size TEXT;
  v_movement_exists BOOLEAN;
  v_items_decremented JSONB := '[]'::jsonb;
  v_actual_paid_at TIMESTAMPTZ;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- If already paid, skip stock but return success
  IF v_order.status = 'pago' AND v_order.payment_status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_paid', true,
      'order_id', p_order_id,
      'message', 'Order was already paid'
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

  -- Decrement stock for each item
  FOR v_item IN
    SELECT product_id, size, quantity
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    v_size := v_item.size;
    IF v_size IS NULL OR v_size = '' THEN
      CONTINUE;
    END IF;

    -- Get product stock
    SELECT erp_stock_by_size, committed_by_size, stock_by_size
    INTO v_product
    FROM product_catalog
    WHERE id = v_item.product_id
    FOR UPDATE; -- Lock row

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Calculate new committed
    v_erpStock := COALESCE(v_product.erp_stock_by_size, v_product.stock_by_size, '{}'::jsonb);
    v_committed := COALESCE(v_product.committed_by_size, '{}'::jsonb);
    
    v_newCommitted := v_committed || jsonb_build_object(
      v_size, COALESCE((v_committed->>v_size)::int, 0) + v_item.quantity
    );

    -- Recalculate display stock
    v_newDisplayStock := '{}'::jsonb;
    FOR v_size IN SELECT jsonb_object_keys(v_erpStock)
    LOOP
      v_newDisplayStock := v_newDisplayStock || jsonb_build_object(
        v_size, 
        GREATEST(0, COALESCE((v_erpStock->>v_size)::int, 0) - COALESCE((v_newCommitted->>v_size)::int, 0))
      );
    END LOOP;

    -- Update product stock
    UPDATE product_catalog
    SET 
      committed_by_size = v_newCommitted,
      stock_by_size = v_newDisplayStock
    WHERE id = v_item.product_id;

    -- Track what was decremented
    v_items_decremented := v_items_decremented || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_item.size,
      'quantity', v_item.quantity
    );
  END LOOP;

  -- Record the movement (ensures idempotency)
  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (p_order_id, 'sale_decrement', v_items_decremented);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'stock_decremented', true,
    'items', v_items_decremented
  );
END;
$function$;
