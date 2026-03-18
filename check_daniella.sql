-- Check if Daniella exists in profiles
SELECT * FROM public.profiles WHERE name ILIKE '%Daniella%' OR whatsapp ILIKE '%991061979%';

-- Check if Daniella exists in customers
SELECT * FROM public.customers WHERE name ILIKE '%Daniella%' OR phone ILIKE '%991061979%';
