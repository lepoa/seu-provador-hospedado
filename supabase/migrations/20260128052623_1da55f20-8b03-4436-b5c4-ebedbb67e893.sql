-- Add ERP stock tracking columns for layered inventory model
-- erp_stock_by_size: Last stock from ERP import (source of truth from ERP)
-- committed_by_size: Paid/confirmed qty not yet synced to ERP (prevents "reappearing" stock)

ALTER TABLE public.product_catalog
ADD COLUMN IF NOT EXISTS erp_stock_by_size jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS committed_by_size jsonb DEFAULT '{}'::jsonb;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_catalog_erp_stock 
ON public.product_catalog USING gin (erp_stock_by_size);

-- Comment for documentation
COMMENT ON COLUMN public.product_catalog.erp_stock_by_size IS 'Stock from last ERP import. Updated during inventory import.';
COMMENT ON COLUMN public.product_catalog.committed_by_size IS 'Qty paid/confirmed but not yet synced to ERP. Prevents stock from reappearing after import.';

-- Create function to calculate available stock for a product/size
-- Available = erp_stock - active_reservations - committed_qty
CREATE OR REPLACE FUNCTION public.get_available_stock(
  p_product_id uuid, 
  p_size text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, 
    COALESCE((
      SELECT (stock_by_size ->> p_size)::integer
      FROM product_catalog 
      WHERE id = p_product_id
    ), 0)
    - 
    COALESCE(get_live_reserved_stock(p_product_id, p_size), 0)
  )::integer
$$;

-- For backward compatibility, copy current stock_by_size to erp_stock_by_size for products that have stock
UPDATE public.product_catalog
SET erp_stock_by_size = COALESCE(stock_by_size, '{}'::jsonb)
WHERE stock_by_size IS NOT NULL AND stock_by_size != '{}'::jsonb;