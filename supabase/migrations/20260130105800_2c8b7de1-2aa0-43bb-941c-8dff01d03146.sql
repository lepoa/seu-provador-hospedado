-- Add discount columns to order_items for price immutability
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS unit_price_original numeric,
ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.order_items.product_price IS 'Final price per unit (after discount)';
COMMENT ON COLUMN public.order_items.unit_price_original IS 'Original price before any discount';
COMMENT ON COLUMN public.order_items.discount_percent IS 'Discount percentage applied (0-100)';
COMMENT ON COLUMN public.order_items.subtotal IS 'Total for this line: product_price * quantity';