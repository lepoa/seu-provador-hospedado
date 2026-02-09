-- Add missing fields to customers table for CRM completeness tracking
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS address_line TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS address_reference TEXT;

-- Add status field to customer_product_suggestions for tracking
ALTER TABLE public.customer_product_suggestions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'nova' CHECK (status IN ('nova', 'mostrei', 'enviei', 'gostou', 'nao_gostou'));

-- Create customer_catalogs table for personalized catalogs
CREATE TABLE IF NOT EXISTS public.customer_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  intro_text TEXT,
  products JSONB DEFAULT '[]'::jsonb,
  public_link TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_inspiration_photos table for quiz photos with merchant notes
CREATE TABLE IF NOT EXISTS public.customer_inspiration_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID,
  image_url TEXT NOT NULL,
  is_starred BOOLEAN DEFAULT false,
  merchant_notes TEXT,
  source TEXT DEFAULT 'quiz' CHECK (source IN ('quiz', 'mission', 'upload')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.customer_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_inspiration_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_catalogs
CREATE POLICY "Merchants can manage catalogs"
ON public.customer_catalogs
FOR ALL
USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view catalogs by link"
ON public.customer_catalogs
FOR SELECT
USING (public_link IS NOT NULL);

-- RLS policies for customer_inspiration_photos
CREATE POLICY "Merchants can manage inspiration photos"
ON public.customer_inspiration_photos
FOR ALL
USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own inspiration photos"
ON public.customer_inspiration_photos
FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for updated_at on customer_catalogs
CREATE TRIGGER update_customer_catalogs_updated_at
BEFORE UPDATE ON public.customer_catalogs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_catalogs_customer_id ON public.customer_catalogs(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_catalogs_public_link ON public.customer_catalogs(public_link);
CREATE INDEX IF NOT EXISTS idx_customer_inspiration_photos_customer_id ON public.customer_inspiration_photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_product_suggestions_status ON public.customer_product_suggestions(status);