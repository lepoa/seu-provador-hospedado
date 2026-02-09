-- Create unique index on phone (only for non-empty values)
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique 
ON public.customers (regexp_replace(phone, '\D', '', 'g'))
WHERE phone IS NOT NULL AND phone != '' AND regexp_replace(phone, '\D', '', 'g') != '';