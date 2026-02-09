-- Create sellers table for sales representatives
CREATE TABLE public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Add trigger for updated_at
CREATE TRIGGER update_sellers_updated_at
BEFORE UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- RLS policies for sellers
CREATE POLICY "Merchants can manage sellers"
ON public.sellers
FOR ALL
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Add seller and notes columns to orders table
ALTER TABLE public.orders
ADD COLUMN seller_id UUID REFERENCES public.sellers(id),
ADD COLUMN internal_notes TEXT;

-- Create index for better performance
CREATE INDEX idx_orders_seller_id ON public.orders(seller_id);