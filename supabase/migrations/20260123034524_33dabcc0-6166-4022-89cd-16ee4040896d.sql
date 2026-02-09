-- Add group_key and erp_sku_by_size columns to product_catalog
ALTER TABLE public.product_catalog 
ADD COLUMN IF NOT EXISTS group_key text,
ADD COLUMN IF NOT EXISTS erp_sku_by_size jsonb DEFAULT '{}'::jsonb;

-- Create index for group_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_catalog_group_key ON public.product_catalog(group_key);

-- Add unique constraint for group_key (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_catalog_group_key_unique 
ON public.product_catalog(group_key) 
WHERE group_key IS NOT NULL;