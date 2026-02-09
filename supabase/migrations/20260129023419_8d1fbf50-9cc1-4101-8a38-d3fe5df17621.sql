-- 5.1: Add normalized indexes for customer deduplication
-- Create function to normalize instagram handles
CREATE OR REPLACE FUNCTION public.normalize_instagram_handle(handle text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(TRIM(BOTH '@' FROM TRIM(COALESCE(handle, ''))))
$$;

-- Create function to normalize phone (E.164)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
$$;

-- Add merged_into_customer_id column for deduplication tracking
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS merged_into_customer_id uuid REFERENCES public.customers(id);

-- Create unique index on normalized instagram handle (partial - only non-empty)
DROP INDEX IF EXISTS idx_customers_instagram_normalized;
CREATE UNIQUE INDEX idx_customers_instagram_normalized 
ON public.customers (normalize_instagram_handle(instagram_handle))
WHERE instagram_handle IS NOT NULL AND TRIM(instagram_handle) != '' AND merged_into_customer_id IS NULL;

-- Create index on normalized phone for lookup (not unique due to possible shared phones)
DROP INDEX IF EXISTS idx_customers_phone_normalized;
CREATE INDEX idx_customers_phone_normalized 
ON public.customers (normalize_phone(phone))
WHERE phone IS NOT NULL AND TRIM(phone) != '' AND merged_into_customer_id IS NULL;

-- Create index on normalized email
DROP INDEX IF EXISTS idx_customers_email_normalized;
CREATE UNIQUE INDEX idx_customers_email_normalized 
ON public.customers (LOWER(TRIM(email)))
WHERE email IS NOT NULL AND TRIM(email) != '' AND merged_into_customer_id IS NULL;

-- 5.2: Add view for consistent order status aggregation
-- Ensure operational_status is the single source of truth for reporting
CREATE OR REPLACE FUNCTION public.get_order_final_status(op_status text, cart_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN op_status = 'entregue' THEN 'entregue'
    WHEN op_status = 'retirado' THEN 'entregue'
    WHEN op_status = 'postado' THEN 'enviado'
    WHEN op_status = 'em_rota' THEN 'em_entrega'
    WHEN op_status = 'etiqueta_gerada' THEN 'preparando'
    WHEN op_status = 'preparar_envio' THEN 'preparando'
    WHEN cart_status = 'pago' THEN 'pago'
    WHEN cart_status = 'cancelado' THEN 'cancelado'
    ELSE 'aguardando'
  END
$$;