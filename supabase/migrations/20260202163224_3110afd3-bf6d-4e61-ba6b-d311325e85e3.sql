-- Add reserved_until column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;

-- Set reserved_until for existing aguardando_pagamento orders (30 minutes from now)
UPDATE public.orders 
SET reserved_until = now() + interval '30 minutes'
WHERE status = 'aguardando_pagamento' 
  AND reserved_until IS NULL;

-- Create trigger to auto-set reserved_until on insert
CREATE OR REPLACE FUNCTION public.set_order_reserved_until()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set for aguardando_pagamento status
  IF NEW.status = 'aguardando_pagamento' AND NEW.reserved_until IS NULL THEN
    NEW.reserved_until := now() + interval '30 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_order_reserved_until ON public.orders;
CREATE TRIGGER trg_set_order_reserved_until
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_reserved_until();