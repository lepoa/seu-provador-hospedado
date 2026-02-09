-- Add unique index on instagram_handle (normalized to lowercase)
-- This ensures no two customers can have the same Instagram handle
CREATE UNIQUE INDEX IF NOT EXISTS customers_instagram_handle_unique 
ON public.customers (LOWER(instagram_handle)) 
WHERE instagram_handle IS NOT NULL AND instagram_handle <> '';

-- Create customer_addresses table for multiple addresses per customer
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Casa', -- Ex: Casa, Trabalho, Outro
  zip_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  reference TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_addresses
CREATE POLICY "Merchants can manage customer addresses"
ON public.customer_addresses FOR ALL
USING (
  has_role(auth.uid(), 'merchant'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'merchant'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Customers can manage their own addresses (linked via customers.user_id)
CREATE POLICY "Users can manage their own addresses"
ON public.customer_addresses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_addresses.customer_id 
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_addresses.customer_id 
    AND c.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default address per customer
CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE public.customer_addresses 
    SET is_default = FALSE 
    WHERE customer_id = NEW.customer_id 
    AND id != NEW.id 
    AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_default_address_trigger
BEFORE INSERT OR UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_address();