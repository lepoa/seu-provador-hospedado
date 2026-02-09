
-- Fix: Include more item statuses for backfill (expirado items should also be synced for existing orders)
-- The key is: if the order exists and has items in live_cart_items, we should sync them regardless of item status

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
  
  -- Insert items from live_cart_items
  -- Include all non-cancelled/removed statuses to ensure we capture items
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
    AND lci.status NOT IN ('removido', 'cancelado', 'substituido');
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  RAISE LOG 'ensure_order_items_for_live_order: inserted % items for order %', v_inserted_count, p_order_id;
  
  RETURN v_inserted_count > 0;
END;
$$;

-- Re-run backfill with updated logic (include expirado status)
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
  AND lci.status NOT IN ('removido', 'cancelado', 'substituido')
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
  );
