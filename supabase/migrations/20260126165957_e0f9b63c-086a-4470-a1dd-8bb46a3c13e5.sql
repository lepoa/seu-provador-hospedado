-- Add structured address fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS address_line TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS address_reference TEXT;

-- Add delivery-related fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'shipping',
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_service TEXT,
ADD COLUMN IF NOT EXISTS shipping_deadline_days INTEGER,
ADD COLUMN IF NOT EXISTS address_snapshot JSONB;

-- Create index for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);