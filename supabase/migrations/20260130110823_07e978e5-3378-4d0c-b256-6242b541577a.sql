-- ===========================================
-- 1) inventory_movements table for idempotent stock tracking
-- ===========================================
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE, -- Only ONE movement per order (idempotent)
  movement_type TEXT NOT NULL DEFAULT 'sale_decrement',
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_id, size, qty}]
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_inventory_movements_order_id ON public.inventory_movements(order_id);

-- Enable RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Merchants can view and manage
CREATE POLICY "Merchants can manage inventory_movements"
  ON public.inventory_movements
  FOR ALL
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- System can insert (for webhook/edge functions)
CREATE POLICY "System can insert inventory_movements"
  ON public.inventory_movements
  FOR INSERT
  WITH CHECK (true);

-- ===========================================
-- 2) finalize_order function - recalculates prices from DB
-- ===========================================
CREATE OR REPLACE FUNCTION public.finalize_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
  v_unit_price_original NUMERIC;
  v_unit_price_final NUMERIC;
  v_discount_percent NUMERIC;
  v_items_subtotal NUMERIC := 0;
  v_order_shipping NUMERIC;
  v_order_coupon_discount NUMERIC;
  v_new_total NUMERIC;
  v_result JSONB := '{"items": [], "success": false}'::jsonb;
BEGIN
  -- Get order shipping and coupon info
  SELECT COALESCE(shipping_fee, 0), COALESCE(coupon_discount, 0)
  INTO v_order_shipping, v_order_coupon_discount
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Loop through order items and recalculate prices from product catalog
  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.size, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Get product price and discount from catalog
    SELECT p.price, p.discount_type, p.discount_value
    INTO v_product
    FROM product_catalog p
    WHERE p.id = v_item.product_id;

    IF NOT FOUND THEN
      -- Product not found, keep existing price
      CONTINUE;
    END IF;

    v_unit_price_original := v_product.price;
    v_discount_percent := 0;
    v_unit_price_final := v_unit_price_original;

    -- Apply discount if exists
    IF v_product.discount_type = 'percentage' AND v_product.discount_value IS NOT NULL AND v_product.discount_value > 0 THEN
      v_discount_percent := v_product.discount_value;
      v_unit_price_final := v_unit_price_original * (1 - v_product.discount_value / 100);
    ELSIF v_product.discount_type = 'fixed' AND v_product.discount_value IS NOT NULL AND v_product.discount_value > 0 THEN
      v_unit_price_final := GREATEST(0, v_unit_price_original - v_product.discount_value);
      v_discount_percent := CASE WHEN v_unit_price_original > 0 
        THEN ROUND((v_product.discount_value / v_unit_price_original) * 100, 2) 
        ELSE 0 END;
    END IF;

    -- Round to 2 decimals
    v_unit_price_final := ROUND(v_unit_price_final, 2);

    -- Update order_item with recalculated prices
    UPDATE order_items
    SET 
      product_price = v_unit_price_final,
      unit_price_original = v_unit_price_original,
      discount_percent = v_discount_percent,
      subtotal = ROUND(v_unit_price_final * quantity, 2)
    WHERE id = v_item.id;

    -- Accumulate subtotal
    v_items_subtotal := v_items_subtotal + (v_unit_price_final * v_item.quantity);

    -- Add to result
    v_result := jsonb_set(v_result, '{items}', 
      v_result->'items' || jsonb_build_object(
        'product_id', v_item.product_id,
        'size', v_item.size,
        'quantity', v_item.quantity,
        'unit_price_original', v_unit_price_original,
        'discount_percent', v_discount_percent,
        'unit_price_final', v_unit_price_final,
        'subtotal', ROUND(v_unit_price_final * v_item.quantity, 2)
      )
    );
  END LOOP;

  -- Calculate new total: items_subtotal - coupon_discount + shipping
  v_new_total := ROUND(GREATEST(0, v_items_subtotal - v_order_coupon_discount) + v_order_shipping, 2);

  -- Update order with recalculated subtotal and total
  UPDATE orders
  SET 
    subtotal = ROUND(v_items_subtotal, 2),
    total = v_new_total,
    updated_at = now()
  WHERE id = p_order_id;

  v_result := jsonb_set(v_result, '{success}', 'true'::jsonb);
  v_result := jsonb_set(v_result, '{items_subtotal}', to_jsonb(ROUND(v_items_subtotal, 2)));
  v_result := jsonb_set(v_result, '{coupon_discount}', to_jsonb(v_order_coupon_discount));
  v_result := jsonb_set(v_result, '{shipping}', to_jsonb(v_order_shipping));
  v_result := jsonb_set(v_result, '{new_total}', to_jsonb(v_new_total));

  RETURN v_result;
END;
$$;

-- ===========================================
-- 3) apply_paid_effects function - called when payment approved
-- Handles: status update, stock decrement (idempotent), triggers
-- ===========================================
CREATE OR REPLACE FUNCTION public.apply_paid_effects(
  p_order_id UUID,
  p_confirmed_amount NUMERIC DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_gateway TEXT DEFAULT 'mercado_pago'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;