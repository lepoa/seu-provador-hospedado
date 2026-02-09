-- Add payment confirmed amount field to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_confirmed_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS customer_notes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;

-- Add customer notes to live_carts (if not exists)
-- customer_live_notes already exists, but let's add a separate checkout notes field
ALTER TABLE public.live_carts
ADD COLUMN IF NOT EXISTS customer_checkout_notes text DEFAULT NULL;

-- Add comment explaining usage
COMMENT ON COLUMN public.orders.payment_confirmed_amount IS 'Actual amount confirmed by payment gateway - source of truth for financial reports';
COMMENT ON COLUMN public.orders.customer_notes IS 'Customer observations/notes from checkout - never overwritten by status updates';
COMMENT ON COLUMN public.orders.subtotal IS 'Products total before shipping and discounts';