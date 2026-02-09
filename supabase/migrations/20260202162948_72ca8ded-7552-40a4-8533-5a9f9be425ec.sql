-- Drop view that depends on the function
DROP VIEW IF EXISTS public.product_available_stock;

-- Drop and recreate get_reserved_stock_map with expired reservation filter
DROP FUNCTION IF EXISTS public.get_reserved_stock_map();

CREATE OR REPLACE FUNCTION public.get_reserved_stock_map()
RETURNS TABLE(product_id uuid, size text, reserved integer) AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Live cart reservations (items in 'reservado' status from active live carts)
  live_reserved AS (
    SELECT 
      lci.product_id,
      COALESCE(lci.variante->>'size', lci.variante->>'tamanho', 'ÚNICO') as size_key,
      SUM(lci.qtd)::int as qty
    FROM live_cart_items lci
    JOIN live_carts lc ON lc.id = lci.live_cart_id
    WHERE 
      lci.status = 'reservado'
      AND lc.status NOT IN ('pago', 'cancelado', 'expirado')
      AND lc.stock_decremented_at IS NULL
    GROUP BY lci.product_id, size_key
  ),
  -- Order reservations (catalog orders not yet paid/cancelled and not expired)
  order_reserved AS (
    SELECT
      oi.product_id,
      COALESCE(oi.size, 'ÚNICO') as size_key,
      SUM(oi.quantity)::int as qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE
      o.status NOT IN ('cancelado', 'pago', 'pagamento_rejeitado', 'reembolsado')
      AND o.stock_decremented_at IS NULL
      -- Only count reservations that haven't expired
      AND (o.reserved_until IS NULL OR o.reserved_until > now())
    GROUP BY oi.product_id, size_key
  ),
  -- Combine both sources
  combined AS (
    SELECT lr.product_id, lr.size_key, lr.qty FROM live_reserved lr
    UNION ALL
    SELECT orr.product_id, orr.size_key, orr.qty FROM order_reserved orr
  )
  SELECT 
    c.product_id,
    c.size_key as size,
    SUM(c.qty)::int as reserved
  FROM combined c
  GROUP BY c.product_id, c.size_key;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Recreate the view
CREATE OR REPLACE VIEW public.product_available_stock AS
WITH stock_data AS (
  SELECT 
    p.id AS product_id,
    size_key.key AS size,
    COALESCE((
      CASE
        WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size <> '{}'::jsonb 
        THEN p.erp_stock_by_size
        ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
      END ->> size_key.key)::integer, 0) AS on_hand,
    COALESCE((p.committed_by_size ->> size_key.key)::integer, 0) AS committed
  FROM product_catalog p
  CROSS JOIN LATERAL jsonb_object_keys(
    CASE
      WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size <> '{}'::jsonb 
      THEN p.erp_stock_by_size
      ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
    END
  ) size_key(key)
),
reserved_data AS (
  SELECT 
    product_id,
    size,
    reserved
  FROM get_reserved_stock_map()
)
SELECT 
  sd.product_id,
  sd.size,
  sd.on_hand,
  sd.committed,
  COALESCE(rd.reserved, 0) AS reserved,
  GREATEST(0, sd.on_hand - sd.committed - COALESCE(rd.reserved, 0)) AS available
FROM stock_data sd
LEFT JOIN reserved_data rd ON rd.product_id = sd.product_id AND rd.size = sd.size;

-- Create function to expire reservations (called by cron or edge function)
CREATE OR REPLACE FUNCTION public.expire_order_reservations()
RETURNS TABLE(expired_order_id uuid, old_status text) AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE orders
    SET 
      status = 'cancelado',
      updated_at = now()
    WHERE 
      status = 'aguardando_pagamento'
      AND reserved_until IS NOT NULL
      AND reserved_until < now()
    RETURNING id, 'aguardando_pagamento' as old_status
  )
  SELECT e.id, e.old_status FROM expired e;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Grant execution to anon and authenticated for edge function calls
GRANT EXECUTE ON FUNCTION public.expire_order_reservations() TO anon;
GRANT EXECUTE ON FUNCTION public.expire_order_reservations() TO authenticated;