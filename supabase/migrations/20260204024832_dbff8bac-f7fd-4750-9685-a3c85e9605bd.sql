-- Add shipping status fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_status text DEFAULT 'aguardando_etiqueta',
ADD COLUMN IF NOT EXISTS shipping_label_generated_at timestamptz NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.shipping_status IS 'Status do envio: aguardando_etiqueta, etiqueta_gerada, enviado, entregue';
COMMENT ON COLUMN public.orders.shipping_label_generated_at IS 'Timestamp de quando a etiqueta foi gerada';

-- Update existing orders that have tracking_code to have shipping_status = etiqueta_gerada
UPDATE public.orders 
SET shipping_status = 'etiqueta_gerada',
    shipping_label_generated_at = updated_at
WHERE tracking_code IS NOT NULL 
  AND tracking_code != ''
  AND (shipping_status IS NULL OR shipping_status = 'aguardando_etiqueta');