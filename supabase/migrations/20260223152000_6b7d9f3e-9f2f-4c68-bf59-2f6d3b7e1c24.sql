-- Fix product_available_stock drift: committed shown by the view can diverge from
-- product_catalog.committed_by_size in some environments.
--
-- Strategy:
-- 1) Normalize committed_by_size keys globally (trim + upper).
-- 2) Recreate product_available_stock with deterministic committed calculation from JSONB.
-- 3) Keep reserved from get_reserved_stock_map().

UPDATE public.product_catalog p
SET committed_by_size = COALESCE(
  (
    SELECT jsonb_object_agg(size_key, to_jsonb(total_qty))
    FROM (
      SELECT
        upper(btrim(e.key)) AS size_key,
        GREATEST(0, SUM(COALESCE((e.value)::int, 0))) AS total_qty
      FROM jsonb_each_text(COALESCE(p.committed_by_size, '{}'::jsonb)) AS e(key, value)
      WHERE btrim(e.key) <> ''
      GROUP BY upper(btrim(e.key))
    ) s
  ),
  '{}'::jsonb
);

DROP VIEW IF EXISTS public.public_product_stock;
DROP VIEW IF EXISTS public.product_available_stock;

CREATE VIEW public.product_available_stock
WITH (security_invoker = on)
AS
WITH size_source AS (
  SELECT
    p.id AS product_id,
    size_key.key AS size
  FROM public.product_catalog p
  CROSS JOIN LATERAL jsonb_object_keys(
    CASE
      WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size <> '{}'::jsonb
        THEN p.erp_stock_by_size
      ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
    END
  ) AS size_key(key)
),
stock_data AS (
  SELECT
    p.id AS product_id,
    ss.size,
    COALESCE((
      CASE
        WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size <> '{}'::jsonb
          THEN p.erp_stock_by_size
        ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
      END ->> ss.size
    )::int, 0) AS stock,
    COALESCE((
      SELECT SUM(COALESCE((j.value)::int, 0))
      FROM jsonb_each_text(COALESCE(p.committed_by_size, '{}'::jsonb)) AS j(key, value)
      WHERE upper(btrim(j.key)) = upper(btrim(ss.size))
    ), 0) AS committed
  FROM public.product_catalog p
  JOIN size_source ss ON ss.product_id = p.id
),
reserved_data AS (
  SELECT
    product_id,
    size,
    reserved
  FROM public.get_reserved_stock_map()
)
SELECT
  sd.product_id,
  sd.size,
  sd.stock,
  COALESCE(rd.reserved, 0) AS reserved,
  sd.committed,
  GREATEST(0, sd.stock - sd.committed - COALESCE(rd.reserved, 0)) AS available
FROM stock_data sd
LEFT JOIN reserved_data rd
  ON rd.product_id = sd.product_id
 AND upper(btrim(rd.size)) = upper(btrim(sd.size));

CREATE VIEW public.public_product_stock
WITH (security_invoker = on)
AS
SELECT
  pas.product_id,
  pas.size,
  pas.available
FROM public.product_available_stock pas
JOIN public.product_catalog pc ON pc.id = pas.product_id
WHERE pc.is_active = true;

GRANT SELECT ON public.product_available_stock TO authenticated;
GRANT SELECT ON public.public_product_stock TO anon, authenticated;
