-- Fix reserved stock calculation for catalog pending orders.
--
-- Problem after reserve_order_stock change:
-- - Reservations are persisted in inventory_movements (movement_type = 'reservation')
-- - get_reserved_stock_map may miss some pending catalog orders if order_items are absent/incomplete
--   for that order at read time.
--
-- Solution:
-- - Read pending reservations primarily from inventory_movements.
-- - Keep a fallback from order_items only when no reservation movement exists for the order.

CREATE OR REPLACE FUNCTION public.get_reserved_stock_map()
RETURNS TABLE(product_id uuid, size text, reserved integer)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH live_reserved AS (
    SELECT
      lci.product_id,
      upper(btrim(COALESCE(NULLIF(lci.variante->>'size', ''), NULLIF(lci.variante->>'tamanho', ''), 'UNICO'))) AS size_key,
      SUM(lci.qtd)::int AS qty
    FROM public.live_cart_items lci
    JOIN public.live_carts lc ON lc.id = lci.live_cart_id
    WHERE lci.status = 'reservado'
      AND lc.status NOT IN ('pago', 'cancelado', 'expirado')
      AND lc.stock_decremented_at IS NULL
    GROUP BY lci.product_id, size_key
  ),
  order_reserved_from_movement AS (
    SELECT
      (ji->>'product_id')::uuid AS product_id,
      upper(btrim(COALESCE(NULLIF(ji->>'size', ''), NULLIF(ji->>'tamanho', ''), 'UNICO'))) AS size_key,
      SUM(
        COALESCE(
          CASE WHEN COALESCE(ji->>'qty', '') ~ '^[0-9]+$' THEN (ji->>'qty')::int ELSE NULL END,
          CASE WHEN COALESCE(ji->>'quantity', '') ~ '^[0-9]+$' THEN (ji->>'quantity')::int ELSE NULL END,
          CASE WHEN COALESCE(ji->>'qtd', '') ~ '^[0-9]+$' THEN (ji->>'qtd')::int ELSE NULL END,
          0
        )
      )::int AS qty
    FROM public.orders o
    JOIN public.inventory_movements im
      ON im.order_id = o.id
     AND im.movement_type = 'reservation'
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(im.items_json, '[]'::jsonb)) AS ji
    WHERE o.status NOT IN ('cancelado', 'pago', 'pagamento_rejeitado', 'reembolsado')
      AND o.stock_decremented_at IS NULL
      AND (o.reserved_until IS NULL OR o.reserved_until > now())
    GROUP BY (ji->>'product_id')::uuid, upper(btrim(COALESCE(NULLIF(ji->>'size', ''), NULLIF(ji->>'tamanho', ''), 'UNICO')))
  ),
  order_reserved_from_items_fallback AS (
    SELECT
      oi.product_id,
      upper(btrim(COALESCE(NULLIF(oi.size, ''), 'UNICO'))) AS size_key,
      SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelado', 'pago', 'pagamento_rejeitado', 'reembolsado')
      AND o.stock_decremented_at IS NULL
      AND (o.reserved_until IS NULL OR o.reserved_until > now())
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_movements im
        WHERE im.order_id = o.id
          AND im.movement_type = 'reservation'
      )
    GROUP BY oi.product_id, upper(btrim(COALESCE(NULLIF(oi.size, ''), 'UNICO')))
  ),
  combined AS (
    SELECT lr.product_id, lr.size_key, lr.qty FROM live_reserved lr
    UNION ALL
    SELECT orm.product_id, orm.size_key, orm.qty FROM order_reserved_from_movement orm
    UNION ALL
    SELECT orf.product_id, orf.size_key, orf.qty FROM order_reserved_from_items_fallback orf
  )
  SELECT
    c.product_id,
    c.size_key AS size,
    SUM(c.qty)::int AS reserved
  FROM combined c
  WHERE c.product_id IS NOT NULL
    AND c.size_key IS NOT NULL
    AND c.size_key <> ''
    AND c.qty > 0
  GROUP BY c.product_id, c.size_key;
END;
$$;
