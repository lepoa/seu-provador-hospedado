-- Add missing columns to live_carts for complete delivery tracking
-- Column: delivery_period for motoboy delivery time preference
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS delivery_period text;

-- Column: shipping_service_name for Correios service details  
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS shipping_service_name text;

-- Column: shipping_deadline_days for delivery time estimate
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS shipping_deadline_days integer;

-- Add comment for documentation
COMMENT ON COLUMN public.live_carts.delivery_period IS 'Delivery time preference for motoboy: manha, tarde, qualquer';
COMMENT ON COLUMN public.live_carts.shipping_service_name IS 'Selected shipping service name (e.g., PAC, SEDEX)';
COMMENT ON COLUMN public.live_carts.shipping_deadline_days IS 'Estimated delivery days for shipping';