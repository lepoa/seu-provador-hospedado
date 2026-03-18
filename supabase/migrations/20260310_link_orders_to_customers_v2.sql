-- =======================================================
-- AUTOMATIC CUSTOMER LINKING FOR ORDERS V2 (FIXED)
-- =======================================================

-- 1. Ensure helper exists
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

-- 2. Trigger Function to link customer and user_id (CORRECTED COLUMN NAME)
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
    WHERE public.normalize_phone_simple(phone) = v_norm_phone -- FIX: column name is 'phone'
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
    -- Try by phone in profiles (column name is 'whatsapp' here)
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

-- 3. Update sync_live_cart_to_orders to avoid creating duplicates (ENHANCED)
CREATE OR REPLACE FUNCTION public.trigger_sync_live_cart_to_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_customer_id uuid;
  v_live_customer RECORD;
  v_live_event RECORD;
  v_order_status text;
  v_norm_phone text;
BEGIN
  IF current_setting('app.syncing_order', true) = 'true' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status 
     AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at
     AND OLD.total IS NOT DISTINCT FROM NEW.total THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_live_cart', 'true', true);

  BEGIN
    SELECT * INTO v_live_customer FROM live_customers WHERE id = NEW.live_customer_id;
    SELECT * INTO v_live_event FROM live_events WHERE id = NEW.live_event_id;
    v_norm_phone := public.normalize_phone_simple(v_live_customer.whatsapp);

    v_order_status := CASE NEW.status
      WHEN 'aberto' THEN 'pendente'
      WHEN 'em_confirmacao' THEN 'aguardando_pagamento'
      WHEN 'aguardando_pagamento' THEN 'aguardando_pagamento'
      WHEN 'pago' THEN 'pago'
      WHEN 'cancelado' THEN 'cancelado'
      WHEN 'expirado' THEN 'cancelado'
      ELSE 'pendente'
    END;

    SELECT id INTO v_order_id FROM orders WHERE live_cart_id = NEW.id;

    IF v_order_id IS NOT NULL THEN
      UPDATE orders SET status = v_order_status, total = NEW.total, subtotal = NEW.subtotal, updated_at = now()
      WHERE id = v_order_id AND status IS DISTINCT FROM v_order_status;
    ELSE
      IF NEW.status IN ('em_confirmacao', 'aguardando_pagamento', 'pago') THEN
        
        -- IMPROVED SEARCH: Use normalization to find existing customer
        IF v_live_customer.client_id IS NOT NULL THEN
          v_customer_id := v_live_customer.client_id;
        ELSE
          SELECT id INTO v_customer_id
          FROM public.customers
          WHERE (public.normalize_phone_simple(phone) = v_norm_phone AND v_norm_phone IS NOT NULL)
             OR (lower(trim(replace(instagram_handle, '@', ''))) = lower(trim(replace(v_live_customer.instagram_handle, '@', ''))) AND v_live_customer.instagram_handle IS NOT NULL)
          ORDER BY created_at DESC LIMIT 1;

          IF v_customer_id IS NULL AND v_live_customer.whatsapp IS NOT NULL THEN
            INSERT INTO customers (phone, name, instagram_handle)
            VALUES (v_live_customer.whatsapp, v_live_customer.nome, v_live_customer.instagram_handle)
            RETURNING id INTO v_customer_id;
          END IF;
        END IF;

        INSERT INTO orders (
          customer_id, status, total, subtotal, shipping_cost, discount, source, live_cart_id, live_id, live_bag_number, paid_at, paid_method, delivery_method, customer_name, customer_phone
        ) VALUES (
          v_customer_id, v_order_status, NEW.total, NEW.subtotal, NEW.frete, NEW.descontos, 'live', NEW.id, NEW.live_event_id, NEW.bag_number, NEW.paid_at, NEW.paid_method, NEW.delivery_method, 
          v_live_customer.nome, v_live_customer.whatsapp
        ) RETURNING id INTO v_order_id;

        UPDATE live_carts SET order_id = v_order_id WHERE id = NEW.id;
        PERFORM public.ensure_order_items_for_live_order(v_order_id);
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_sync_live_cart_to_orders error: %', SQLERRM;
  END;

  PERFORM set_config('app.syncing_live_cart', 'false', true);
  RETURN NEW;
END;
$$;

-- 4. Apply Triggers
DROP TRIGGER IF EXISTS on_order_insert_link_customer ON public.orders;
CREATE TRIGGER on_order_insert_link_customer
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.link_order_to_customer_and_profile();

-- 5. Retroactive fix for #C6212199
DO $$
DECLARE
  v_cust_id UUID;
  v_u_id UUID;
BEGIN
  -- Find the REAL Lais Torres record
  SELECT id INTO v_cust_id FROM public.customers WHERE (phone ILIKE '%982691262' OR instagram_handle ILIKE '%laistmelo%') AND nome ILIKE '%Torres%' LIMIT 1;
  -- Find her Auth profile
  SELECT user_id INTO v_u_id FROM public.profiles WHERE whatsapp ILIKE '%982691262' LIMIT 1;

  IF v_cust_id IS NOT NULL THEN
    UPDATE public.orders 
    SET customer_id = v_cust_id,
        user_id = COALESCE(user_id, v_u_id)
    WHERE live_bag_number = 199 -- Based on screenshot #C6212199 likely means bag 199
       OR (customer_phone ILIKE '%982691262' AND customer_id IS NULL);
  END IF;
END $$;
