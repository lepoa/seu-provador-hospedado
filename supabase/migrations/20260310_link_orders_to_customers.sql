-- =======================================================
-- AUTOMATIC CUSTOMER LINKING FOR ORDERS
-- =======================================================

-- 1. Helper to unify phone normalization
CREATE OR REPLACE FUNCTION public.normalize_phone_simple(phone text)
RETURNS text AS $$
DECLARE
  norm text;
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  norm := regexp_replace(phone, '[^0-9]', '', 'g');
  -- Remove leading 0
  IF norm LIKE '0%' THEN norm := substr(norm, 2); END IF;
  -- Add country code 55 if missing (assuming BR)
  IF length(norm) IN (10, 11) THEN norm := '55' || norm; END IF;
  RETURN norm;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Trigger Function to link customer and user_id
CREATE OR REPLACE FUNCTION public.link_order_to_customer_and_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_user_id UUID;
  v_norm_phone TEXT;
  v_norm_handle TEXT;
BEGIN
  v_norm_phone := public.normalize_phone_simple(NEW.customer_phone);
  
  -- A. LINK CUSTOMER_ID if missing
  IF NEW.customer_id IS NULL THEN
    -- A1. Try by phone number in CRM customers
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE public.normalize_phone_simple(whatsapp) = v_norm_phone
      AND merged_into_customer_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    -- A2. Try by instagram handle (via identities) if phone failed
    IF v_customer_id IS NULL AND NEW.live_cart_id IS NOT NULL THEN
      -- Get handle from live_customer
      SELECT lower(trim(replace(lc.instagram_handle, '@', ''))) INTO v_norm_handle
      FROM public.live_customers lc
      JOIN public.live_carts lct ON lct.live_customer_id = lc.id
      WHERE lct.id = NEW.live_cart_id;

      IF v_norm_handle IS NOT NULL THEN
        SELECT customer_id INTO v_customer_id
        FROM public.instagram_identities
        WHERE instagram_handle_normalized = v_norm_handle
        LIMIT 1;
      END IF;
    END IF;

    -- Assign if found
    IF v_customer_id IS NOT NULL THEN
      NEW.customer_id := v_customer_id;
    END IF;
  END IF;

  -- B. LINK USER_ID if missing
  IF NEW.user_id IS NULL THEN
    -- Try by phone in profiles
    SELECT user_id INTO v_user_id
    FROM public.profiles
    WHERE public.normalize_phone_simple(whatsapp) = v_norm_phone
    LIMIT 1;

    -- Assign if found
    IF v_user_id IS NOT NULL THEN
      NEW.user_id := v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Trigger
DROP TRIGGER IF EXISTS on_order_insert_link_customer ON public.orders;
CREATE TRIGGER on_order_insert_link_customer
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.link_order_to_customer_and_profile();

-- 4. Retroactive fix for the most recent order of "@laistmelo" if it exists
DO $$
DECLARE
  v_cust_id UUID;
  v_u_id UUID;
BEGIN
  -- Find Lais Torres
  SELECT id INTO v_cust_id FROM public.customers WHERE instagram_handle ILIKE '%laistmelo%' LIMIT 1;
  SELECT user_id INTO v_u_id FROM public.profiles WHERE whatsapp ILIKE '%982691262' LIMIT 1;

  IF v_cust_id IS NOT NULL THEN
    UPDATE public.orders 
    SET customer_id = v_cust_id,
        user_id = COALESCE(user_id, v_u_id)
    WHERE customer_phone ILIKE '%982691262'
      AND (customer_id IS NULL OR user_id IS NULL);
  END IF;
END $$;
