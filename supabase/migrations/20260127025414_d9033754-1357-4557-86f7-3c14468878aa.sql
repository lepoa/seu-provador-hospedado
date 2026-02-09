-- Add email column to customers table for more complete customer data
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS email text;

-- Create unique index on email (allowing nulls and empty strings)
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique 
ON public.customers (email) 
WHERE email IS NOT NULL AND email != '';