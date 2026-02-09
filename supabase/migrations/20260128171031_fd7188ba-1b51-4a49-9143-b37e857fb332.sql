-- Add charge tracking and enhanced delivery fields to live_carts
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS last_charge_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charge_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS charge_channel TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS charge_by_user UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_period TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paid_method TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paid_by_user UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_review_status TEXT DEFAULT 'none';

-- Add comment descriptions
COMMENT ON COLUMN public.live_carts.last_charge_at IS 'Last time a payment reminder was sent';
COMMENT ON COLUMN public.live_carts.charge_attempts IS 'Number of payment reminder attempts';
COMMENT ON COLUMN public.live_carts.charge_channel IS 'Channel used for charge: whatsapp or direct';
COMMENT ON COLUMN public.live_carts.delivery_period IS 'For motoboy: manha, tarde, qualquer';
COMMENT ON COLUMN public.live_carts.delivery_notes IS 'Delivery instructions from customer';
COMMENT ON COLUMN public.live_carts.payment_proof_url IS 'URL to payment proof image for manual payments';
COMMENT ON COLUMN public.live_carts.payment_review_status IS 'none, pending_review, approved, rejected';

-- Create charge log table for audit trail
CREATE TABLE IF NOT EXISTS public.live_charge_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_cart_id UUID NOT NULL REFERENCES public.live_carts(id) ON DELETE CASCADE,
  charged_by UUID DEFAULT NULL,
  channel TEXT NOT NULL,
  message_template TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on charge logs
ALTER TABLE public.live_charge_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for charge logs
CREATE POLICY "Merchants can manage charge logs"
ON public.live_charge_logs
FOR ALL
USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));