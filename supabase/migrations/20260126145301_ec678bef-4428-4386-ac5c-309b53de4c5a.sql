-- Create table for customer product suggestions
CREATE TABLE public.customer_product_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, customer_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_customer_product_suggestions_product ON public.customer_product_suggestions(product_id);
CREATE INDEX idx_customer_product_suggestions_customer ON public.customer_product_suggestions(customer_id);
CREATE INDEX idx_customer_product_suggestions_score ON public.customer_product_suggestions(score DESC);

-- Enable RLS
ALTER TABLE public.customer_product_suggestions ENABLE ROW LEVEL SECURITY;

-- Merchants can view and manage suggestions
CREATE POLICY "Merchants can view suggestions"
ON public.customer_product_suggestions
FOR SELECT
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can insert suggestions"
ON public.customer_product_suggestions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can update suggestions"
ON public.customer_product_suggestions
FOR UPDATE
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can delete suggestions"
ON public.customer_product_suggestions
FOR DELETE
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_customer_product_suggestions_updated_at
BEFORE UPDATE ON public.customer_product_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();