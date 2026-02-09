-- Add missing payment tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT NULL;

-- Add index for faster queries on payment status
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Comment on columns
COMMENT ON COLUMN public.orders.paid_at IS 'Timestamp when payment was confirmed';
COMMENT ON COLUMN public.orders.gateway IS 'Payment gateway used (mercado_pago, manual, etc)';