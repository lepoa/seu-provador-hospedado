-- =======================================================
-- FIX: Stock Double-Decrement Bug When Marking Order as Paid
-- =======================================================
-- PROBLEM: apply_paid_effects() increments committed_by_size AND recalculates stock_by_size.
-- The view product_available_stock then uses stock_by_size (already decremented) as on_hand
-- and subtracts committed AGAIN → double decrement.
--
-- SOLUTION: apply_paid_effects() should ONLY update committed_by_size, NOT touch stock_by_size.
-- The view already calculates available = on_hand - committed - reserved.
-- stock_by_size should only be modified when ERP syncs or manual adjustments.
-- =======================================================

-- Fix the apply_paid_effects function
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
  -- The view calculates: available = on_hand - committed - reserved
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

-- Also fix apply_live_cart_paid_effects with the same pattern
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
  -- Lock the cart row to prevent race conditions
  SELECT * INTO v_cart FROM live_carts WHERE id = p_live_cart_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Live cart not found');
  END IF;

  -- Check if already processed (idempotent)
  IF v_cart.stock_decremented_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_processed', true,
      'live_cart_id', p_live_cart_id,
      'message', 'Stock already committed at ' || v_cart.stock_decremented_at::text
    );
  END IF;

  -- Check if movement already exists (double idempotency check)
  SELECT EXISTS(
    SELECT 1 FROM inventory_movements 
    WHERE order_id = p_live_cart_id 
    AND movement_type IN ('live_sale_decrement', 'live_sale_committed')
  ) INTO v_movement_exists;

  IF v_movement_exists THEN
    -- Fix the missing flag
    UPDATE live_carts SET stock_decremented_at = now() WHERE id = p_live_cart_id;
    RETURN jsonb_build_object(
      'success', true, 
      'already_processed', true,
      'reason', 'Movement already exists',
      'live_cart_id', p_live_cart_id
    );
  END IF;

  -- Process each confirmed item - ONLY update committed_by_size
  FOR v_item IN
    SELECT 
      lci.product_id,
      (lci.variante->>'tamanho')::text as size,
      lci.qtd as quantity
    FROM live_cart_items lci
    WHERE lci.live_cart_id = p_live_cart_id
    AND lci.status = 'confirmado'
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
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_committed := COALESCE(v_committed, '{}'::jsonb);
    
    -- Increment committed
    v_newCommitted := v_committed || jsonb_build_object(
      v_size, COALESCE((v_committed->>v_size)::int, 0) + v_item.quantity
    );

    -- ONLY update committed_by_size, NOT stock_by_size
    UPDATE product_catalog
    SET committed_by_size = v_newCommitted
    WHERE id = v_item.product_id;

    -- Track committed items
    v_items_committed := v_items_committed || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_size,
      'quantity', v_item.quantity
    );
  END LOOP;

  -- Record movement for audit and idempotency
  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (p_live_cart_id, 'live_sale_committed', v_items_committed);

  -- Mark cart as processed
  UPDATE live_carts 
  SET stock_decremented_at = now() 
  WHERE id = p_live_cart_id;

  -- Log the action
  INSERT INTO live_cart_status_history (live_cart_id, old_status, new_status, notes)
  VALUES (p_live_cart_id, 'pago', 'pago', 'Estoque comprometido: ' || jsonb_array_length(v_items_committed)::text || ' itens');

  RETURN jsonb_build_object(
    'success', true,
    'live_cart_id', p_live_cart_id,
    'stock_committed', true,
    'items_count', jsonb_array_length(v_items_committed),
    'items', v_items_committed
  );
END;
$$;

-- Update get_reserved_stock_map to EXCLUDE orders/carts that have stock_decremented_at set
-- (because those are already in committed_by_size)
CREATE OR REPLACE FUNCTION public.get_reserved_stock_map()
RETURNS TABLE(product_id uuid, size text, reserved integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH live_reserved AS (
    SELECT
      lci.product_id,
      COALESCE(
        NULLIF(lci.variante->>'tamanho', ''),
        NULLIF(lci.variante->>'tamanho_letra', ''),
        NULLIF(lci.variante->>'tamanho_numero', '')
      ) AS size,
      SUM(lci.qtd)::int AS qty
    FROM public.live_cart_items lci
    JOIN public.live_carts lc ON lc.id = lci.live_cart_id
    WHERE
      lci.status IN ('reservado', 'confirmado')
      AND lc.status NOT IN ('cancelado', 'expirado', 'pago') -- Exclude PAID
      AND lc.stock_decremented_at IS NULL -- Not yet committed
      AND COALESCE(
        NULLIF(lci.variante->>'tamanho', ''),
        NULLIF(lci.variante->>'tamanho_letra', ''),
        NULLIF(lci.variante->>'tamanho_numero', '')
      ) IS NOT NULL
    GROUP BY 1, 2
  ),
  order_reserved AS (
    SELECT
      oi.product_id,
      NULLIF(oi.size, '') AS size,
      SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE
      o.status NOT IN ('cancelado', 'pago') -- Pending orders only
      AND o.stock_decremented_at IS NULL -- Not yet committed
      AND NULLIF(oi.size, '') IS NOT NULL
    GROUP BY 1, 2
  )
  SELECT
    product_id,
    size,
    SUM(qty)::int AS reserved
  FROM (
    SELECT product_id, size, qty FROM live_reserved
    UNION ALL
    SELECT product_id, size, qty FROM order_reserved
  ) t
  GROUP BY 1, 2;
$$;