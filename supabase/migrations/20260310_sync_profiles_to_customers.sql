-- =======================================================
-- AUTOMATIC PROFILE TO CUSTOMER SYNCHRONIZATION
-- =======================================================

-- 1. Function to sync profile data to customers table
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_norm_whatsapp TEXT;
BEGIN
  -- We only sync if there is a name and whatsapp/phone
  IF NEW.name IS NULL AND NEW.whatsapp IS NULL THEN
    RETURN NEW;
  END IF;

  v_norm_whatsapp := public.normalize_phone_simple(NEW.whatsapp);

  -- A. Try to find existing customer by user_id
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE user_id = NEW.user_id
  LIMIT 1;

  -- B. If not found by user_id, try by normalized phone
  IF v_customer_id IS NULL AND v_norm_whatsapp IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE public.normalize_phone_simple(phone) = v_norm_whatsapp
    LIMIT 1;
  END IF;

  -- C. Upsert into customers
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET 
      name = COALESCE(NEW.name, name),
      phone = COALESCE(NEW.whatsapp, phone),
      instagram_handle = COALESCE(NEW.instagram_handle, instagram_handle),
      user_id = NEW.user_id,
      updated_at = now()
    WHERE id = v_customer_id;
  ELSE
    INSERT INTO public.customers (user_id, name, phone, instagram_handle)
    VALUES (NEW.user_id, NEW.name, NEW.whatsapp, NEW.instagram_handle);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger on profiles
DROP TRIGGER IF EXISTS trg_sync_profile_to_customer ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_customer
AFTER INSERT OR UPDATE OF name, whatsapp, instagram_handle ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_customer();

-- 3. Retroactive Sync for missing customers
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.* 
    FROM public.profiles p
    LEFT JOIN public.customers c ON c.user_id = p.user_id
    WHERE c.id IS NULL 
      AND (p.name IS NOT NULL OR p.whatsapp IS NOT NULL)
  LOOP
    -- This will trigger the sync logic manually for each missing profile
    UPDATE public.profiles 
    SET updated_at = now() 
    WHERE id = r.id;
  END LOOP;
END $$;
