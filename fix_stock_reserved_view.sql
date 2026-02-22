-- ============================================================
-- FIX: Split stock into Reservado (unpaid) vs Vendido (paid)
-- ============================================================
-- The product_available_stock view currently reads committed_by_size
-- as one bucket. This migration changes it to compute:
--   reserved = unpaid order items (movement_type = 'reservation') + live reservations
--   committed (sold) = paid order items (movement_type = 'sale_committed')
--   available = stock - reserved - committed
-- ============================================================

-- Drop dependent view first
DROP VIEW IF EXISTS public.public_product_stock CASCADE;
DROP VIEW IF EXISTS public.product_available_stock CASCADE;

CREATE OR REPLACE VIEW public.product_available_stock
WITH (security_invoker = on)
AS
WITH stock_data AS (
  -- Base stock from ERP (or stock_by_size for backward compat)
  SELECT
    p.id as product_id,
    kv.key as size,
    COALESCE((kv.value)::int, 0) as stock
  FROM product_catalog p
  CROSS JOIN LATERAL jsonb_each_text(
    CASE
      WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size != '{}'::jsonb
      THEN p.erp_stock_by_size
      ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
    END
  ) kv
  WHERE p.is_active = true
),
-- Catalog order reservations (unpaid orders)
catalog_reserved AS (
  SELECT
    (item->>'product_id')::uuid as product_id,
    item->>'size' as size,
    SUM(COALESCE((item->>'qty')::int, (item->>'quantity')::int, 0))::int as reserved
  FROM inventory_movements im
  CROSS JOIN LATERAL jsonb_array_elements(im.items_json) AS item
  WHERE im.movement_type = 'reservation'
  GROUP BY (item->>'product_id')::uuid, item->>'size'
),
-- Sold stock (paid orders not yet synced to ERP)
catalog_sold AS (
  SELECT
    (item->>'product_id')::uuid as product_id,
    item->>'size' as size,
    SUM(COALESCE((item->>'qty')::int, (item->>'quantity')::int, 0))::int as committed
  FROM inventory_movements im
  CROSS JOIN LATERAL jsonb_array_elements(im.items_json) AS item
  WHERE im.movement_type = 'sale_committed'
  GROUP BY (item->>'product_id')::uuid, item->>'size'
),
-- Live shop reservations (active carts not yet paid)
live_reserved AS (
  SELECT
    lci.product_id,
    lci.variante->>'tamanho' as size,
    SUM(lci.qtd)::int as reserved
  FROM live_cart_items lci
  JOIN live_carts lc ON lc.id = lci.live_cart_id
  WHERE lci.status IN ('reservado', 'confirmado')
    AND lc.status NOT IN ('cancelado', 'expirado', 'pago')
    AND lc.stock_decremented_at IS NULL
  GROUP BY lci.product_id, lci.variante->>'tamanho'
)
SELECT
  sd.product_id,
  sd.size,
  sd.stock,
  -- Reserved = unpaid catalog orders + live reservations
  (COALESCE(cr.reserved, 0) + COALESCE(lr.reserved, 0)) as reserved,
  -- Committed (sold) = paid orders not yet synced to ERP
  COALESCE(cs.committed, 0) as committed,
  -- Available = stock - reserved - committed
  GREATEST(0, sd.stock - COALESCE(cr.reserved, 0) - COALESCE(lr.reserved, 0) - COALESCE(cs.committed, 0)) as available
FROM stock_data sd
LEFT JOIN catalog_reserved cr
  ON cr.product_id = sd.product_id AND cr.size = sd.size
LEFT JOIN catalog_sold cs
  ON cs.product_id = sd.product_id AND cs.size = sd.size
LEFT JOIN live_reserved lr
  ON lr.product_id = sd.product_id AND lr.size = sd.size;

-- Recreate public_product_stock view (public-facing, only shows available)
CREATE OR REPLACE VIEW public.public_product_stock
WITH (security_invoker = on)
AS
SELECT
  product_id,
  size,
  available
FROM public.product_available_stock;

-- Grant permissions
GRANT SELECT ON public.product_available_stock TO authenticated;
GRANT SELECT ON public.public_product_stock TO anon, authenticated;
