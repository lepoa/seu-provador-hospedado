-- Fix trigger function that still references NEW.order_number (column does not exist)
-- This was causing: record "new" has no field "order_number" on UPDATE public.orders

CREATE OR REPLACE FUNCTION public.credit_loyalty_points_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_order_total numeric;
  v_base_points integer;
  v_multiplier numeric;
  v_tier_slug text;
  v_no_expiry boolean;
  v_expires_at timestamptz;
  v_loyalty_id uuid;
  v_points_per_real integer;
  v_expiry_months integer;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    v_user_id := NEW.user_id;

    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_order_total := NEW.subtotal;

    SELECT 
      COALESCE((setting_value->>'points_per_real')::integer, 1),
      COALESCE((setting_value->>'points_expiry_months')::integer, 12)
    INTO v_points_per_real, v_expiry_months
    FROM public.loyalty_settings
    WHERE setting_key = 'general';

    SELECT id, current_tier INTO v_loyalty_id, v_tier_slug
    FROM public.customer_loyalty
    WHERE user_id = v_user_id;

    IF v_loyalty_id IS NULL THEN
      INSERT INTO public.customer_loyalty (user_id, current_tier)
      VALUES (v_user_id, 'poa')
      RETURNING id, current_tier INTO v_loyalty_id, v_tier_slug;
    END IF;

    SELECT multiplier, no_expiry INTO v_multiplier, v_no_expiry
    FROM public.loyalty_tiers
    WHERE slug = v_tier_slug AND is_active = true;

    v_multiplier := COALESCE(v_multiplier, 1.0);
    v_no_expiry := COALESCE(v_no_expiry, false);

    v_base_points := FLOOR(v_order_total * v_points_per_real);

    IF v_no_expiry THEN
      v_expires_at := NULL;
    ELSE
      v_expires_at := now() + (v_expiry_months || ' months')::interval;
    END IF;

    INSERT INTO public.point_transactions (
      user_id,
      type,
      points,
      base_points,
      multiplier,
      description,
      order_id,
      expires_at
    ) VALUES (
      v_user_id,
      'earn',
      FLOOR(v_base_points * v_multiplier),
      v_base_points,
      v_multiplier,
      -- orders table does not have order_number; use UUID prefix for display
      'Compra #' || LEFT(NEW.id::text, 8),
      NEW.id,
      v_expires_at
    );

    UPDATE public.customer_loyalty
    SET 
      current_points = current_points + FLOOR(v_base_points * v_multiplier),
      lifetime_points = lifetime_points + FLOOR(v_base_points * v_multiplier),
      annual_points = annual_points + FLOOR(v_base_points * v_multiplier),
      updated_at = now()
    WHERE id = v_loyalty_id;
  END IF;

  RETURN NEW;
END;
$function$;
