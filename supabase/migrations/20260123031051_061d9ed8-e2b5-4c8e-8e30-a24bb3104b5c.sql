-- Add SKU field to product_catalog (unique, required for new products)
ALTER TABLE public.product_catalog 
ADD COLUMN IF NOT EXISTS sku text UNIQUE;

-- Create index for faster SKU lookups
CREATE INDEX IF NOT EXISTS idx_product_catalog_sku ON public.product_catalog(sku);

-- Create inventory_imports table for history
CREATE TABLE public.inventory_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  updated_products jsonb DEFAULT '[]'::jsonb,
  unmatched_skus jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;

-- Only merchants/admins can view import history
CREATE POLICY "Merchants can view inventory imports"
ON public.inventory_imports
FOR SELECT
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Only merchants/admins can create imports
CREATE POLICY "Merchants can create inventory imports"
ON public.inventory_imports
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));