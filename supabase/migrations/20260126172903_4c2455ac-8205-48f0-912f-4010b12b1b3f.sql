-- Add dimension columns to product_catalog
ALTER TABLE public.product_catalog
ADD COLUMN IF NOT EXISTS length_cm NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS width_cm NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.product_catalog.length_cm IS 'Product length in centimeters';
COMMENT ON COLUMN public.product_catalog.width_cm IS 'Product width in centimeters';
COMMENT ON COLUMN public.product_catalog.height_cm IS 'Product height in centimeters';