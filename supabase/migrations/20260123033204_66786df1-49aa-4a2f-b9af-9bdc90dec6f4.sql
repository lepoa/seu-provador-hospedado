-- Add created_from_import column to track products created via stock import
ALTER TABLE public.product_catalog 
ADD COLUMN IF NOT EXISTS created_from_import boolean DEFAULT false;