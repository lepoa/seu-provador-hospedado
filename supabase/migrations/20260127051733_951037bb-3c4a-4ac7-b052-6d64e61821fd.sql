-- Create table to track live cart status changes
CREATE TABLE public.live_cart_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_cart_id UUID NOT NULL REFERENCES public.live_carts(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  payment_method TEXT,
  notes TEXT,
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_live_cart_status_history_cart_id ON public.live_cart_status_history(live_cart_id);

-- Enable RLS
ALTER TABLE public.live_cart_status_history ENABLE ROW LEVEL SECURITY;

-- Policy for merchants to manage status history
CREATE POLICY "Merchants can manage status history"
  ON public.live_cart_status_history
  FOR ALL
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_cart_status_history;