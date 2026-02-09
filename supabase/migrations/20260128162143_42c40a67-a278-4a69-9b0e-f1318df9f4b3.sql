-- Add seller_id and shipping logistics fields to live_carts
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id),
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'retirada',
ADD COLUMN IF NOT EXISTS shipping_address_snapshot jsonb,
ADD COLUMN IF NOT EXISTS me_shipment_id text,
ADD COLUMN IF NOT EXISTS me_label_url text,
ADD COLUMN IF NOT EXISTS shipping_tracking_code text,
ADD COLUMN IF NOT EXISTS operational_status text DEFAULT 'aguardando_pagamento';

-- Create index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_live_carts_seller_id ON public.live_carts(seller_id);
CREATE INDEX IF NOT EXISTS idx_live_carts_operational_status ON public.live_carts(operational_status);
CREATE INDEX IF NOT EXISTS idx_live_carts_delivery_method ON public.live_carts(delivery_method);

-- Add comment for documentation
COMMENT ON COLUMN public.live_carts.seller_id IS 'Vendedora responsável pelo pedido';
COMMENT ON COLUMN public.live_carts.delivery_method IS 'Método de entrega: retirada, motoboy, correios';
COMMENT ON COLUMN public.live_carts.operational_status IS 'Status operacional pós-live: aguardando_pagamento, pago, preparar_envio, etiqueta_gerada, postado, entregue';
COMMENT ON COLUMN public.live_carts.me_shipment_id IS 'ID do envio no Melhor Envio';
COMMENT ON COLUMN public.live_carts.me_label_url IS 'URL da etiqueta de envio gerada';
COMMENT ON COLUMN public.live_carts.shipping_tracking_code IS 'Código de rastreio do envio';