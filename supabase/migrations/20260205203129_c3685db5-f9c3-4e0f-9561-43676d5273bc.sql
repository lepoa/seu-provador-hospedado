
-- ===============================================================
-- SECURITY HARDENING PART 3 - FIX SECURITY DEFINER VIEWS
-- ===============================================================
-- PostgreSQL 15+ default is SECURITY INVOKER, but we need to set explicitly
-- to ensure the linter passes

-- =============================================
-- 1) RECREATE VIEWS WITH EXPLICIT SECURITY INVOKER
-- =============================================

-- Drop and recreate loyalty_reports_summary
DROP VIEW IF EXISTS public.loyalty_reports_summary;
CREATE VIEW public.loyalty_reports_summary
WITH (security_invoker = on)
AS
SELECT 
  date_trunc('month', created_at) AS month,
  SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS points_earned,
  SUM(CASE WHEN points < 0 AND type = 'redemption' THEN abs(points) ELSE 0 END) AS points_redeemed,
  SUM(CASE WHEN expired = true THEN points ELSE 0 END) AS points_expired,
  COUNT(DISTINCT user_id) AS active_users
FROM public.point_transactions pt
GROUP BY date_trunc('month', created_at)
ORDER BY date_trunc('month', created_at) DESC;

-- Drop and recreate product_available_stock
DROP VIEW IF EXISTS public.public_product_stock;
DROP VIEW IF EXISTS public.product_available_stock;

CREATE VIEW public.product_available_stock
WITH (security_invoker = on)
AS
WITH stock_data AS (
  SELECT 
    p.id AS product_id,
    size_key.key AS size,
    COALESCE(((
      CASE
        WHEN p.erp_stock_by_size IS NOT NULL AND p.erp_stock_by_size <> '{}'::jsonb 
        THEN p.erp_stock_by_size
        ELSE COALESCE(p.stock_by_size, '{}'::jsonb)
      END ->> size_key.key))::integer, 0) AS on_hand,
    COALESCE((p.committed_by_size ->> size_key.key)::integer, 0) AS committed
  FROM public.product_catalog p
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
  FROM public.get_reserved_stock_map()
)
SELECT 
  sd.product_id,
  sd.size,
  sd.on_hand,
  sd.committed,
  COALESCE(rd.reserved, 0) AS reserved,
  GREATEST(0, (sd.on_hand - sd.committed) - COALESCE(rd.reserved, 0)) AS available
FROM stock_data sd
LEFT JOIN reserved_data rd ON rd.product_id = sd.product_id AND rd.size = sd.size;

-- Recreate public_product_stock (depends on product_available_stock)
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
