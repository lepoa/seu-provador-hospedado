-- Remove the trigger that auto-maps sizes
DROP TRIGGER IF EXISTS trigger_map_sizes ON public.product_catalog;

-- Drop the function
DROP FUNCTION IF EXISTS public.map_numeric_to_letter_sizes();

-- Clean up: remove letter sizes that were auto-added from products that originally only had numeric sizes
-- This sets letter sizes back to 0 for products that have numeric stock
UPDATE public.product_catalog
SET stock_by_size = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(COALESCE(stock_by_size, '{}'::jsonb))
  WHERE key NOT IN ('PP', 'P', 'M', 'G', 'GG')
     OR (stock_by_size->>'34')::int IS NULL
)
WHERE stock_by_size IS NOT NULL
  AND (stock_by_size->>'34' IS NOT NULL OR stock_by_size->>'36' IS NOT NULL 
       OR stock_by_size->>'38' IS NOT NULL OR stock_by_size->>'40' IS NOT NULL
       OR stock_by_size->>'42' IS NOT NULL OR stock_by_size->>'44' IS NOT NULL
       OR stock_by_size->>'46' IS NOT NULL);