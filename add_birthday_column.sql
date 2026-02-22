-- Add birth_date column to customers table for Le.Poá Club birthday discounts
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create index for birthday month queries (for admin panel "aniversariantes do mês")
CREATE INDEX IF NOT EXISTS idx_customers_birth_month 
ON public.customers (EXTRACT(MONTH FROM birth_date))
WHERE birth_date IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.customers.birth_date IS 'Data de nascimento do cliente para desconto de aniversário Le.Poá Club';
