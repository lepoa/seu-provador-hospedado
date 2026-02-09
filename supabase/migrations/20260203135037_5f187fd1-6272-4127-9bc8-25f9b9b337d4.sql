
-- =====================================================
-- FIX: Ensure Live orders have order_items before stock commit
-- =====================================================

-- 1) Create function to ensure order_items exist for live orders
CREATE OR REPLACE FUNCTION public.ensure_order_items_for_live_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_items_exist BOOLEAN;
  v_inserted_count INT := 0;
BEGIN
  -- Get order info
  SELECT id, source, live_cart_id 
  INTO v_order
  FROM orders 
  WHERE id = p_order_id;
  
  -- If not a live order, nothing to do
  IF v_order.source IS DISTINCT FROM 'live' OR v_order.live_cart_id IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if order_items already exist (idempotency)
  SELECT EXISTS(
    SELECT 1 FROM order_items WHERE order_id = p_order_id
  ) INTO v_items_exist;
  
  IF v_items_exist THEN
    RETURN true; -- Already has items, nothing to do
  END IF;
  
  -- Insert items from live_cart_items (valid statuses: reservado, confirmado)
  INSERT INTO order_items (
    order_id,
    product_id,
    product_name,
    product_sku,
    size,
    color,
    quantity,
    product_price,
    unit_price_original,
    image_url,
    subtotal
  )
  SELECT
    p_order_id,
    lci.product_id,
    COALESCE(pc.name, 'Produto'),
    COALESCE(pc.sku, ''),
    COALESCE(lci.variante->>'tamanho', 'U'),
    COALESCE(lci.variante->>'cor', pc.color, ''),
    lci.qtd,
    lci.preco_unitario,
    lci.preco_unitario,
    pc.image_url,
    lci.preco_unitario * lci.qtd
  FROM live_cart_items lci
  LEFT JOIN product_catalog pc ON pc.id = lci.product_id
  WHERE lci.live_cart_id = v_order.live_cart_id
    AND lci.status IN ('reservado', 'confirmado');
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  RAISE LOG 'ensure_order_items_for_live_order: inserted % items for order %', v_inserted_count, p_order_id;
  
  RETURN v_inserted_count > 0;
END;
$$;

-- 2) Create a new trigger function that ensures items exist before stock commit
CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_items_synced BOOLEAN;
  v_items_count INT;
  v_item RECORD;
  v_current_stock JSONB;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement_exists BOOLEAN;
  v_items_array JSONB := '[]'::jsonb;
BEGIN
  -- First, ensure order_items exist for live orders
  v_items_synced := ensure_order_items_for_live_order(NEW.id);
  
  -- Check if we have items now
  SELECT COUNT(*) INTO v_items_count FROM order_items WHERE order_id = NEW.id;
  
  -- If still no items, log error and block stock operations
  IF v_items_count = 0 THEN
    RAISE WARNING 'Order % marked as paid but has no items. Skipping stock decrement.', NEW.id;
    -- We don't block the status change, but we skip stock operations
    -- The stock_decremented_at will remain NULL signaling incomplete processing
    RETURN NEW;
  END IF;
  
  -- Skip if already processed
  IF NEW.stock_decremented_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if movement already exists (idempotency via inventory_movements)
  SELECT EXISTS(
    SELECT 1 FROM inventory_movements WHERE order_id = NEW.id
  ) INTO v_movement_exists;
  
  IF v_movement_exists THEN
    NEW.stock_decremented_at := now();
    RETURN NEW;
  END IF;
  
  -- Process each order item
  FOR v_item IN
    SELECT oi.product_id, oi.size, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    v_size := v_item.size;
    v_qty := v_item.quantity;
    
    SELECT stock_by_size, committed_by_size 
    INTO v_current_stock, v_current_committed
    FROM product_catalog 
    WHERE id = v_item.product_id
    FOR UPDATE;
    
    IF v_current_stock IS NOT NULL THEN
      v_current_stock := jsonb_set(
        COALESCE(v_current_stock, '{}'::jsonb),
        ARRAY[v_size],
        to_jsonb(GREATEST(0, COALESCE((v_current_stock->>v_size)::int, 0) - v_qty))
      );
      
      v_current_committed := jsonb_set(
        COALESCE(v_current_committed, '{}'::jsonb),
        ARRAY[v_size],
        to_jsonb(GREATEST(0, COALESCE((v_current_committed->>v_size)::int, 0) - v_qty))
      );
      
      UPDATE product_catalog
      SET stock_by_size = v_current_stock,
          committed_by_size = v_current_committed
      WHERE id = v_item.product_id;
      
      v_items_array := v_items_array || jsonb_build_object(
        'product_id', v_item.product_id,
        'size', v_size,
        'qty', v_qty
      );
    END IF;
  END LOOP;
  
  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (NEW.id, 'sale_decrement', v_items_array)
  ON CONFLICT (order_id) DO NOTHING;
  
  NEW.stock_decremented_at := now();
  
  RETURN NEW;
END;
$$;

-- 3) Replace the old trigger with the new unified one
DROP TRIGGER IF EXISTS trigger_decrement_stock_on_paid ON orders;

CREATE TRIGGER trigger_handle_order_paid
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago')
  EXECUTE FUNCTION handle_order_paid();

-- 4) Backfill: Insert order_items for existing live orders that don't have them
INSERT INTO order_items (
  order_id,
  product_id,
  product_name,
  product_sku,
  size,
  color,
  quantity,
  product_price,
  unit_price_original,
  image_url,
  subtotal
)
SELECT
  o.id,
  lci.product_id,
  COALESCE(pc.name, 'Produto'),
  COALESCE(pc.sku, ''),
  COALESCE(lci.variante->>'tamanho', 'U'),
  COALESCE(lci.variante->>'cor', pc.color, ''),
  lci.qtd,
  lci.preco_unitario,
  lci.preco_unitario,
  pc.image_url,
  lci.preco_unitario * lci.qtd
FROM orders o
JOIN live_cart_items lci ON lci.live_cart_id = o.live_cart_id
LEFT JOIN product_catalog pc ON pc.id = lci.product_id
WHERE o.source = 'live'
  AND o.live_cart_id IS NOT NULL
  AND lci.status IN ('reservado', 'confirmado')
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
  );

-- 5) Also update the sync trigger to ensure items are created on initial sync
CREATE OR REPLACE FUNCTION public.sync_live_cart_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_customer RECORD;
  v_live_event RECORD;
  v_order_status text;
  v_address_snapshot jsonb;
BEGIN
  -- Only sync for certain statuses
  IF NEW.status NOT IN ('confirmado', 'aguardando_pagamento', 'pago', 'cancelado') THEN
    RETURN NEW;
  END IF;
  
  -- Get customer info
  SELECT * INTO v_customer FROM live_customers WHERE id = NEW.live_customer_id;
  
  -- Get live event info
  SELECT * INTO v_live_event FROM live_events WHERE id = NEW.live_event_id;
  
  -- Map live cart status to order status
  v_order_status := CASE NEW.status
    WHEN 'pago' THEN 
      CASE NEW.operational_status
        WHEN 'postado' THEN 'enviado'
        WHEN 'etiqueta_gerada' THEN 'etiqueta_gerada'
        WHEN 'separado' THEN 'pago'
        ELSE 'pago'
      END
    WHEN 'cancelado' THEN 'cancelado'
    ELSE 'aguardando_pagamento'
  END;
  
  -- Build address snapshot
  v_address_snapshot := NEW.shipping_address_snapshot;
  
  -- Upsert order
  INSERT INTO orders (
    id,
    source,
    live_cart_id,
    live_event_id,
    live_bag_number,
    customer_name,
    customer_phone,
    customer_email,
    address_snapshot,
    subtotal,
    shipping_fee,
    total,
    status,
    payment_method,
    paid_at,
    shipping_tracking_code,
    me_shipment_id,
    me_label_url,
    created_at,
    updated_at
  )
  VALUES (
    COALESCE(NEW.order_id, gen_random_uuid()),
    'live',
    NEW.id,
    NEW.live_event_id,
    NEW.bag_number,
    COALESCE(v_customer.nome, v_customer.instagram_handle),
    v_customer.whatsapp,
    NULL,
    v_address_snapshot,
    NEW.subtotal,
    NEW.frete,
    NEW.total,
    v_order_status,
    NEW.paid_method,
    NEW.paid_at,
    NEW.shipping_tracking_code,
    NEW.me_shipment_id,
    NEW.me_label_url,
    NEW.created_at,
    now()
  )
  ON CONFLICT (live_cart_id) WHERE live_cart_id IS NOT NULL
  DO UPDATE SET
    live_bag_number = EXCLUDED.live_bag_number,
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    address_snapshot = COALESCE(EXCLUDED.address_snapshot, orders.address_snapshot),
    subtotal = EXCLUDED.subtotal,
    shipping_fee = EXCLUDED.shipping_fee,
    total = EXCLUDED.total,
    status = EXCLUDED.status,
    payment_method = COALESCE(EXCLUDED.payment_method, orders.payment_method),
    paid_at = COALESCE(EXCLUDED.paid_at, orders.paid_at),
    shipping_tracking_code = COALESCE(EXCLUDED.shipping_tracking_code, orders.shipping_tracking_code),
    me_shipment_id = COALESCE(EXCLUDED.me_shipment_id, orders.me_shipment_id),
    me_label_url = COALESCE(EXCLUDED.me_label_url, orders.me_label_url),
    updated_at = now()
  RETURNING id INTO v_order_id;
  
  -- Update live_cart with order_id reference
  IF NEW.order_id IS NULL THEN
    NEW.order_id := v_order_id;
  END IF;
  
  -- Ensure order_items are synced for this order
  PERFORM ensure_order_items_for_live_order(v_order_id);
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_sync_live_cart_to_order ON live_carts;

CREATE TRIGGER trigger_sync_live_cart_to_order
  BEFORE INSERT OR UPDATE ON live_carts
  FOR EACH ROW
  EXECUTE FUNCTION sync_live_cart_to_order();

-- Create unique index for upsert if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_live_cart_id_unique 
ON orders (live_cart_id) 
WHERE live_cart_id IS NOT NULL;
