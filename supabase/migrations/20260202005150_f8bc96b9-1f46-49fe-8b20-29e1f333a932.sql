-- Create a centralized view for available stock per product + size
-- This view calculates: on_hand (ERP stock), reserved (live carts), available = on_hand - reserved

-- First, update the get_live_reserved_stock function to use the correct logic
CREATE OR REPLACE FUNCTION public.get_live_reserved_stock(p_product_id uuid, p_size text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(lci.qtd), 0)::INTEGER
  FROM public.live_cart_items lci
  JOIN public.live_carts lc ON lc.id = lci.live_cart_id
  WHERE lci.product_id = p_product_id
    AND lci.variante->>'tamanho' = p_size
    AND lci.status IN ('reservado', 'confirmado')
    -- Exclude cancelled/expired carts
    AND lc.status NOT IN ('cancelado', 'expirado')
    -- Exclude carts where stock was already decremented (pago + processed)
    AND lc.stock_decremented_at IS NULL
$function$;

-- Create the product_available_stock view
CREATE OR REPLACE VIEW public.product_available_stock AS
WITH stock_data AS (
  SELECT 
    p.id AS product_id,
    size_key.key AS size,
    COALESCE((COALESCE(p.erp_stock_by_size, p.stock_by_size, '{}'::jsonb) ->> size_key.key)::integer, 0) AS on_hand,
    COALESCE((p.committed_by_size ->> size_key.key)::integer, 0) AS committed
  FROM product_catalog p
  CROSS JOIN LATERAL jsonb_object_keys(COALESCE(p.erp_stock_by_size, p.stock_by_size, '{}'::jsonb)) AS size_key(key)
),
reserved_data AS (
  SELECT 
    lci.product_id,
    lci.variante->>'tamanho' AS size,
    SUM(lci.qtd) AS reserved_qty
  FROM live_cart_items lci
  JOIN live_carts lc ON lc.id = lci.live_cart_id
  WHERE lci.status IN ('reservado', 'confirmado')
    AND lc.status NOT IN ('cancelado', 'expirado')
    AND lc.stock_decremented_at IS NULL
  GROUP BY lci.product_id, lci.variante->>'tamanho'
)
SELECT 
  sd.product_id,
  sd.size,
  sd.on_hand,
  sd.committed,
  COALESCE(rd.reserved_qty, 0)::integer AS reserved,
  GREATEST(0, sd.on_hand - sd.committed - COALESCE(rd.reserved_qty, 0))::integer AS available
FROM stock_data sd
LEFT JOIN reserved_data rd ON rd.product_id = sd.product_id AND rd.size = sd.size;

-- Grant access to the view
GRANT SELECT ON public.product_available_stock TO anon, authenticated;

-- Also update get_available_stock function to use the new logic
CREATE OR REPLACE FUNCTION public.get_available_stock(p_product_id uuid, p_size text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(available, 0)
  FROM public.product_available_stock
  WHERE product_id = p_product_id AND size = p_size
$function$;