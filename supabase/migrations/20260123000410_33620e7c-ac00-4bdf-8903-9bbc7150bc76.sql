-- Add new columns to product_catalog for more detailed product info
ALTER TABLE public.product_catalog 
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS style text,
ADD COLUMN IF NOT EXISTS occasion text,
ADD COLUMN IF NOT EXISTS modeling text,
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add linked_product_id to print_requests for product linking
ALTER TABLE public.print_requests
ADD COLUMN IF NOT EXISTS linked_product_id uuid REFERENCES public.product_catalog(id),
ADD COLUMN IF NOT EXISTS response_sent boolean DEFAULT false;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'products' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'products' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'products' AND auth.uid() IS NOT NULL);

-- Update RLS policies for product_catalog to support multi-tenant
DROP POLICY IF EXISTS "Authenticated can manage products" ON public.product_catalog;

CREATE POLICY "Users can manage their own products"
ON public.product_catalog FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Add index for faster product queries
CREATE INDEX IF NOT EXISTS idx_product_catalog_user_id ON public.product_catalog(user_id);
CREATE INDEX IF NOT EXISTS idx_product_catalog_is_active ON public.product_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON public.product_catalog(category);
CREATE INDEX IF NOT EXISTS idx_product_catalog_style ON public.product_catalog(style);

-- Add index for print_requests linked products
CREATE INDEX IF NOT EXISTS idx_print_requests_linked_product ON public.print_requests(linked_product_id);