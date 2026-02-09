-- Create payments table to track Mercado Pago transactions
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  amount_total NUMERIC NOT NULL DEFAULT 0,
  installments INTEGER DEFAULT 1,
  payer_email TEXT,
  payer_phone TEXT,
  raw_webhook_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for order lookups
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_payments_mp_preference_id ON public.payments(mp_preference_id);
CREATE INDEX idx_payments_mp_payment_id ON public.payments(mp_payment_id);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments (via order)
CREATE POLICY "Users can view their own payments"
ON public.payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = payments.order_id 
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- System can insert payments (via edge function with service role)
CREATE POLICY "System can manage payments"
ON public.payments FOR ALL
USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add payment_status to orders for quick reference
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS mp_checkout_url TEXT;