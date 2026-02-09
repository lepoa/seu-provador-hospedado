-- Add missing columns to customers table for order metrics
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_order_at timestamp with time zone;

-- Create index on phone for faster lookups (normalized phone is the unique key)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- Create a trigger function to update customer stats when orders are created
CREATE OR REPLACE FUNCTION public.update_customer_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone TEXT;
  existing_customer_id UUID;
BEGIN
  -- Normalize phone (remove non-digits)
  normalized_phone := regexp_replace(NEW.customer_phone, '\D', '', 'g');
  
  -- Skip if no phone
  IF normalized_phone IS NULL OR normalized_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Find or create customer
  SELECT id INTO existing_customer_id
  FROM public.customers
  WHERE regexp_replace(phone, '\D', '', 'g') = normalized_phone
  LIMIT 1;
  
  IF existing_customer_id IS NULL THEN
    -- Create new customer
    INSERT INTO public.customers (phone, name, user_id, total_orders, total_spent, last_order_at)
    VALUES (
      normalized_phone,
      NEW.customer_name,
      NEW.user_id,
      1,
      NEW.total,
      NEW.created_at
    )
    RETURNING id INTO existing_customer_id;
  ELSE
    -- Update existing customer
    UPDATE public.customers
    SET
      name = COALESCE(NULLIF(NEW.customer_name, ''), name),
      user_id = COALESCE(NEW.user_id, user_id),
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      last_order_at = GREATEST(last_order_at, NEW.created_at),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;
  
  -- Link order to customer
  NEW.customer_id := existing_customer_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_update_customer_on_order ON public.orders;
CREATE TRIGGER trigger_update_customer_on_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_on_order();

-- Backfill: Update existing customers with stats from orders
WITH order_stats AS (
  SELECT 
    regexp_replace(customer_phone, '\D', '', 'g') as normalized_phone,
    COUNT(*) as order_count,
    SUM(total) as total_amount,
    MAX(created_at) as last_order
  FROM public.orders
  WHERE customer_phone IS NOT NULL AND customer_phone != ''
  GROUP BY regexp_replace(customer_phone, '\D', '', 'g')
)
UPDATE public.customers c
SET 
  total_orders = COALESCE(os.order_count, 0),
  total_spent = COALESCE(os.total_amount, 0),
  last_order_at = os.last_order
FROM order_stats os
WHERE regexp_replace(c.phone, '\D', '', 'g') = os.normalized_phone;

-- Create missing customers from orders that don't have a matching customer
INSERT INTO public.customers (phone, name, user_id, total_orders, total_spent, last_order_at)
SELECT DISTINCT ON (regexp_replace(o.customer_phone, '\D', '', 'g'))
  regexp_replace(o.customer_phone, '\D', '', 'g') as phone,
  o.customer_name as name,
  o.user_id,
  (SELECT COUNT(*) FROM public.orders o2 WHERE regexp_replace(o2.customer_phone, '\D', '', 'g') = regexp_replace(o.customer_phone, '\D', '', 'g')) as total_orders,
  (SELECT COALESCE(SUM(total), 0) FROM public.orders o2 WHERE regexp_replace(o2.customer_phone, '\D', '', 'g') = regexp_replace(o.customer_phone, '\D', '', 'g')) as total_spent,
  (SELECT MAX(created_at) FROM public.orders o2 WHERE regexp_replace(o2.customer_phone, '\D', '', 'g') = regexp_replace(o.customer_phone, '\D', '', 'g')) as last_order_at
FROM public.orders o
WHERE o.customer_phone IS NOT NULL 
  AND o.customer_phone != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(o.customer_phone, '\D', '', 'g')
  )
ORDER BY regexp_replace(o.customer_phone, '\D', '', 'g'), o.created_at DESC;

-- Update orders to link to customers
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE regexp_replace(o.customer_phone, '\D', '', 'g') = regexp_replace(c.phone, '\D', '', 'g')
  AND o.customer_id IS NULL;