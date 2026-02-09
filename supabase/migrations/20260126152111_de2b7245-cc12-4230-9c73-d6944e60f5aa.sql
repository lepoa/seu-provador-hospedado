-- Add size_letter and size_number columns to customers table
ALTER TABLE public.customers 
ADD COLUMN size_letter text,
ADD COLUMN size_number text;

-- Migrate existing size data to appropriate column
UPDATE public.customers 
SET size_letter = size 
WHERE size IN ('PP', 'P', 'M', 'G', 'GG');

UPDATE public.customers 
SET size_number = size 
WHERE size IN ('34', '36', '38', '40', '42', '44', '46');

-- Add comment for documentation
COMMENT ON COLUMN public.customers.size_letter IS 'Size in letters: PP, P, M, G, GG';
COMMENT ON COLUMN public.customers.size_number IS 'Size in numbers: 34-46';