-- Update the trigger to also sync address from order to customer
CREATE OR REPLACE FUNCTION public.update_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone TEXT;
  existing_customer_id UUID;
  address_data JSONB;
BEGIN
  -- Normalize phone (remove non-digits)
  normalized_phone := regexp_replace(NEW.customer_phone, '\D', '', 'g');
  
  -- Skip if no phone
  IF normalized_phone IS NULL OR normalized_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Extract address data from snapshot if available
  address_data := NEW.address_snapshot;
  
  -- Find or create customer
  SELECT id INTO existing_customer_id
  FROM public.customers
  WHERE regexp_replace(phone, '\D', '', 'g') = normalized_phone
  LIMIT 1;
  
  IF existing_customer_id IS NULL THEN
    -- Create new customer with address data from order
    INSERT INTO public.customers (
      phone, 
      name, 
      user_id, 
      total_orders, 
      total_spent, 
      last_order_at,
      address_line,
      city,
      state,
      zip_code,
      address_reference
    )
    VALUES (
      normalized_phone,
      NEW.customer_name,
      NEW.user_id,
      1,
      NEW.total,
      NEW.created_at,
      COALESCE(address_data->>'address_line', NULL),
      COALESCE(address_data->>'city', NULL),
      COALESCE(address_data->>'state', NULL),
      COALESCE(address_data->>'zip_code', NULL),
      COALESCE(address_data->>'address_reference', NULL)
    )
    RETURNING id INTO existing_customer_id;
  ELSE
    -- Update existing customer with address (only if customer doesn't have address yet)
    UPDATE public.customers
    SET
      name = COALESCE(NULLIF(NEW.customer_name, ''), name),
      user_id = COALESCE(NEW.user_id, user_id),
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      last_order_at = GREATEST(last_order_at, NEW.created_at),
      -- Only update address fields if they are currently null
      address_line = COALESCE(address_line, address_data->>'address_line'),
      city = COALESCE(city, address_data->>'city'),
      state = COALESCE(state, address_data->>'state'),
      zip_code = COALESCE(zip_code, address_data->>'zip_code'),
      address_reference = COALESCE(address_reference, address_data->>'address_reference'),
      updated_at = now()
    WHERE id = existing_customer_id;
  END IF;
  
  -- Link order to customer
  NEW.customer_id := existing_customer_id;
  
  RETURN NEW;
END;
$function$;

-- Also sync existing orders' address data to customers (one-time fix)
UPDATE public.customers c
SET 
  address_line = COALESCE(c.address_line, (o.address_snapshot->>'address_line')),
  city = COALESCE(c.city, (o.address_snapshot->>'city')),
  state = COALESCE(c.state, (o.address_snapshot->>'state')),
  zip_code = COALESCE(c.zip_code, (o.address_snapshot->>'zip_code')),
  address_reference = COALESCE(c.address_reference, (o.address_snapshot->>'address_reference'))
FROM (
  SELECT DISTINCT ON (customer_id) 
    customer_id, 
    address_snapshot
  FROM public.orders
  WHERE customer_id IS NOT NULL 
    AND address_snapshot IS NOT NULL
  ORDER BY customer_id, created_at DESC
) o
WHERE c.id = o.customer_id
  AND (c.address_line IS NULL OR c.city IS NULL OR c.state IS NULL OR c.zip_code IS NULL);