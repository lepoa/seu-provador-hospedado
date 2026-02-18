-- =============================================
-- Birthday Campaign System
-- =============================================

-- 1. Add birth_date to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- 2. Create birthday_discounts table
CREATE TABLE IF NOT EXISTS birthday_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  year integer NOT NULL,
  tier_at_birthday text NOT NULL,
  discount_percent integer NOT NULL,
  coupon_code text UNIQUE,
  notified_at timestamptz,
  renotified_at timestamptz,
  used_at timestamptz,
  order_id uuid,
  expires_at date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Enable RLS
ALTER TABLE birthday_discounts ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own discount records
DROP POLICY IF EXISTS "Users can view own birthday discounts" ON birthday_discounts;
CREATE POLICY "Users can view own birthday discounts"
  ON birthday_discounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: admin can do anything
DROP POLICY IF EXISTS "Admin full access on birthday_discounts" ON birthday_discounts;
CREATE POLICY "Admin full access on birthday_discounts"
  ON birthday_discounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- 3. Function to generate or get birthday discount for current year
CREATE OR REPLACE FUNCTION get_or_create_birthday_discount(p_user_id uuid)
RETURNS TABLE(
  discount_id uuid,
  discount_percent integer,
  coupon_code text,
  used_at timestamptz,
  expires_at date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_birth_date date;
  v_current_month integer;
  v_birth_month integer;
  v_current_year integer;
  v_tier text;
  v_discount integer;
  v_coupon text;
  v_existing_id uuid;
  v_end_of_month date;
BEGIN
  -- Get user's birth date
  SELECT p.birth_date INTO v_birth_date
  FROM profiles p
  WHERE p.user_id = p_user_id;

  IF v_birth_date IS NULL THEN
    RETURN; -- No birthday set
  END IF;

  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  v_birth_month := EXTRACT(MONTH FROM v_birth_date);
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Not birthday month
  IF v_current_month != v_birth_month THEN
    RETURN;
  END IF;

  -- Check if discount already exists for this year
  SELECT bd.id INTO v_existing_id
  FROM birthday_discounts bd
  WHERE bd.user_id = p_user_id AND bd.year = v_current_year;

  IF v_existing_id IS NOT NULL THEN
    -- Return existing
    RETURN QUERY
      SELECT bd.id, bd.discount_percent, bd.coupon_code, bd.used_at, bd.expires_at
      FROM birthday_discounts bd
      WHERE bd.id = v_existing_id;
    RETURN;
  END IF;

  -- Get current tier
  SELECT cl.current_tier INTO v_tier
  FROM customer_loyalty cl
  WHERE cl.user_id = p_user_id;

  v_tier := COALESCE(v_tier, 'poa');

  -- Determine discount %
  CASE v_tier
    WHEN 'poa_black' THEN v_discount := 20;
    WHEN 'poa_platinum' THEN v_discount := 15;
    WHEN 'poa_gold' THEN v_discount := 10;
    ELSE v_discount := 5;
  END CASE;

  -- Generate coupon code
  v_coupon := 'ANIVER-' || upper(substr(md5(random()::text), 1, 6));

  -- End of birthday month
  v_end_of_month := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;

  -- Create discount record
  INSERT INTO birthday_discounts (user_id, year, tier_at_birthday, discount_percent, coupon_code, expires_at)
  VALUES (p_user_id, v_current_year, v_tier, v_discount, v_coupon, v_end_of_month);

  -- Return created record
  RETURN QUERY
    SELECT bd.id, bd.discount_percent, bd.coupon_code, bd.used_at, bd.expires_at
    FROM birthday_discounts bd
    WHERE bd.user_id = p_user_id AND bd.year = v_current_year;
END;
$$;

-- 4. Function for admin to get birthday members of the month
CREATE OR REPLACE FUNCTION get_birthday_members_of_month(p_month integer DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  user_email text,
  user_name text,
  birth_date date,
  whatsapp text,
  tier text,
  discount_percent integer,
  coupon_code text,
  notified_at timestamptz,
  renotified_at timestamptz,
  used_at timestamptz,
  order_id uuid,
  discount_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month integer;
  v_year integer;
BEGIN
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE));
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);

  RETURN QUERY
    SELECT
      p.user_id,
      au.email::text as user_email,
      p.name::text as user_name,
      p.birth_date,
      p.whatsapp::text,
      COALESCE(cl.current_tier, 'poa')::text as tier,
      bd.discount_percent,
      bd.coupon_code::text,
      bd.notified_at,
      bd.renotified_at,
      bd.used_at,
      bd.order_id,
      bd.id as discount_id
    FROM profiles p
    JOIN auth.users au ON au.id = p.user_id
    LEFT JOIN customer_loyalty cl ON cl.user_id = p.user_id
    LEFT JOIN birthday_discounts bd ON bd.user_id = p.user_id AND bd.year = v_year
    WHERE p.birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM p.birth_date) = v_month
    ORDER BY EXTRACT(DAY FROM p.birth_date);
END;
$$;

-- 5. Function to mark birthday discount as notified
CREATE OR REPLACE FUNCTION mark_birthday_notified(p_discount_id uuid, p_is_renotify boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_is_renotify THEN
    UPDATE birthday_discounts SET renotified_at = now() WHERE id = p_discount_id;
  ELSE
    UPDATE birthday_discounts SET notified_at = now() WHERE id = p_discount_id;
  END IF;
END;
$$;

-- 6. Function to mark birthday discount as used
CREATE OR REPLACE FUNCTION mark_birthday_discount_used(p_discount_id uuid, p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE birthday_discounts
  SET used_at = now(), order_id = p_order_id
  WHERE id = p_discount_id;
END;
$$;
