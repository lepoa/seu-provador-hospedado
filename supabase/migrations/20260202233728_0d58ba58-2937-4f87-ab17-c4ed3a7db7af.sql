-- Add document (CPF) column to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS document text;

-- Add document (CPF) column to customer_addresses table
ALTER TABLE public.customer_addresses
ADD COLUMN IF NOT EXISTS document text;

-- Add document (CPF) column to profiles table for customer-facing checkout
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf text;

-- Create index for CPF lookup (normalized without special chars)
CREATE INDEX IF NOT EXISTS idx_customers_document ON public.customers (document) WHERE document IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.customers.document IS 'CPF do cliente (apenas números, 11 dígitos)';
COMMENT ON COLUMN public.customer_addresses.document IS 'CPF do destinatário para envio (apenas números, 11 dígitos)';
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário (apenas números, 11 dígitos)';