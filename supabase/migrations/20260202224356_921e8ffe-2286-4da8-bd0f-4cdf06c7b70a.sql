-- Add product_sku to order_items for packing slip (romaneio)
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS product_sku text;

-- Backfill existing order_items with SKU from product_catalog
UPDATE public.order_items oi
SET product_sku = pc.sku
FROM public.product_catalog pc
WHERE oi.product_id = pc.id
  AND oi.product_sku IS NULL;

-- Add helpful comment
COMMENT ON COLUMN public.order_items.product_sku IS 'SKU/model snapshot at time of order for packing slip';