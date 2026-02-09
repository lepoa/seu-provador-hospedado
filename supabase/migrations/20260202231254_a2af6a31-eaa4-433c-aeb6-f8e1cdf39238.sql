-- Add Melhor Envio shipping label fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS me_shipment_id text,
ADD COLUMN IF NOT EXISTS me_label_url text;

-- Add index for faster lookups of orders needing labels
CREATE INDEX IF NOT EXISTS idx_orders_me_shipment ON public.orders (me_shipment_id) WHERE me_shipment_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.me_shipment_id IS 'Melhor Envio shipment ID returned after label generation';
COMMENT ON COLUMN public.orders.me_label_url IS 'URL to the official Melhor Envio shipping label PDF';