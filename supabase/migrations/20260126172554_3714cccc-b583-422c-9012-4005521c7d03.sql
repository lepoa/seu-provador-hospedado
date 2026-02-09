-- Add weight field to product_catalog
ALTER TABLE public.product_catalog
ADD COLUMN weight_kg NUMERIC(5,2) DEFAULT NULL;

-- Add index for products missing weight (for admin dashboard queries)
CREATE INDEX idx_product_catalog_weight_null ON public.product_catalog(id) WHERE weight_kg IS NULL AND is_active = true;

-- Comment for documentation
COMMENT ON COLUMN public.product_catalog.weight_kg IS 'Product weight in kilograms for shipping calculations';