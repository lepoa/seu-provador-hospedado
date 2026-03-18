-- =======================================================
-- AUTO-CREATE CUSTOMER FOR EVERY NEW AUTH USER
-- =======================================================
-- Ensures every registered user (email, Google, etc.)
-- appears in the dashboard's customer list for marketing.
-- =======================================================

-- 0. Allow phone to be NULL (some users sign up via Google without phone)
ALTER TABLE public.customers ALTER COLUMN phone DROP NOT NULL;

-- 1. Trigger function: creates a customers record on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_existing_id UUID;
BEGIN
  -- Extract available info from the new auth user
  v_email := NEW.email;
  v_name  := COALESCE(
    NEW.raw_user_meta_data->>'full_name',   -- Google
    NEW.raw_user_meta_data->>'name',        -- some providers
    split_part(NEW.email, '@', 1)           -- fallback: email prefix
  );
  v_phone := NEW.raw_user_meta_data->>'phone';  -- if available

  -- Check if a customer already exists for this user_id
  SELECT id INTO v_existing_id
  FROM public.customers
  WHERE user_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Already exists, skip
    RETURN NEW;
  END IF;

  -- Check if a customer with the same email already exists (link them)
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE email = v_email AND user_id IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Link existing customer to this auth user
      UPDATE public.customers
      SET user_id = NEW.id,
          name = COALESCE(name, v_name),
          updated_at = now()
      WHERE id = v_existing_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Create new customer record
  INSERT INTO public.customers (user_id, name, email, phone)
  VALUES (NEW.id, v_name, v_email, v_phone)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_customer();

-- 3. Backfill: create customers records for existing auth users who don't have one
DO $$
DECLARE
  r RECORD;
  v_name TEXT;
  v_existing_id UUID;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.customers c ON c.user_id = u.id
    WHERE c.id IS NULL
  LOOP
    v_name := COALESCE(
      r.raw_user_meta_data->>'full_name',
      r.raw_user_meta_data->>'name',
      split_part(r.email, '@', 1)
    );

    -- Try to link by email first
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE email = r.email AND user_id IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.customers
      SET user_id = r.id,
          name = COALESCE(name, v_name),
          updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.customers (user_id, name, email)
      VALUES (r.id, v_name, r.email)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
