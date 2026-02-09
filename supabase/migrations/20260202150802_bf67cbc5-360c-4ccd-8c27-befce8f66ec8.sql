
-- Fix the product_available_stock view to properly handle empty erp_stock_by_size
-- The issue: COALESCE returns {} when erp_stock_by_size is {} (not NULL)
-- This causes jsonb_object_keys to return no rows, so products don't appear

CREATE OR REPLACE VIEW product_available_stock AS
WITH stock_data AS (
  SELECT 
    p.id AS product_id,
    size_key.key AS size,
    COALESCE(
      (
        CASE 
          WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size != '{}'::jsonb 
          THEN p.erp_stock_by_size
          ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
        END ->> size_key.key
      )::integer, 
      0
    ) AS on_hand,
    COALESCE((p.committed_by_size ->> size_key.key)::integer, 0) AS committed
  FROM product_catalog p
  CROSS JOIN LATERAL jsonb_object_keys(
    CASE 
      WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size != '{}'::jsonb 
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
