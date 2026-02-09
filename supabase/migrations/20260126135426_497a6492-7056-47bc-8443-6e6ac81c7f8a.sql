-- Add missing columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_link TEXT,
ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- Add missing columns to order_items table
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;