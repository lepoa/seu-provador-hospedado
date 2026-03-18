-- =======================================================
-- FIX DEFINITIVO: trigger + backfill com campo correto
-- =======================================================
-- CAUSA RAIZ: o trigger usava raw_user_meta_data->>'phone'
-- mas o campo real é raw_user_meta_data->>'whatsapp'
-- =======================================================

-- STEP 1: Corrigir o trigger para usar o campo correto
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
  v_instagram TEXT;
  v_existing_id UUID;
  v_norm_phone TEXT;
BEGIN
  v_email := NEW.email;
  v_name  := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  -- CORRIGIDO: campo é 'whatsapp', não 'phone'
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'whatsapp',
    NEW.raw_user_meta_data->>'phone'
  );
  v_instagram := NEW.raw_user_meta_data->>'instagram_handle';

  -- A. Já existe customer com este user_id?
  SELECT id INTO v_existing_id
  FROM public.customers
  WHERE user_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- B. Já existe customer com este telefone? (vincula)
  v_norm_phone := public.normalize_phone_simple(v_phone);
  IF v_norm_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE public.normalize_phone_simple(phone) = v_norm_phone
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.customers
      SET user_id = NEW.id,
          email = COALESCE(email, v_email),
          instagram_handle = COALESCE(instagram_handle, v_instagram),
          updated_at = now()
      WHERE id = v_existing_id;
      RETURN NEW;
    END IF;
  END IF;

  -- C. Já existe customer com este email? (vincula)
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE email = v_email AND user_id IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.customers
      SET user_id = NEW.id,
          name = COALESCE(name, v_name),
          phone = COALESCE(phone, v_phone),
          instagram_handle = COALESCE(instagram_handle, v_instagram),
          updated_at = now()
      WHERE id = v_existing_id;
      RETURN NEW;
    END IF;
  END IF;

  -- D. Nenhum match: cria novo
  INSERT INTO public.customers (user_id, name, email, phone, instagram_handle)
  VALUES (NEW.id, v_name, v_email, v_phone, v_instagram)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- STEP 2: Backfill - corrigir os clientes rasos que foram criados sem telefone
-- Para cada cliente sem phone que tem user_id, buscar o whatsapp no auth.users
DO $$
DECLARE
  r RECORD;
  v_phone TEXT;
  v_instagram TEXT;
  v_name TEXT;
  v_real_customer_id UUID;
  v_norm_phone TEXT;
BEGIN
  FOR r IN
    SELECT c.id AS shallow_id, c.user_id, c.email
    FROM public.customers c
    WHERE c.phone IS NULL
      AND c.user_id IS NOT NULL
  LOOP
    -- Buscar dados reais do auth.users
    SELECT
      COALESCE(u.raw_user_meta_data->>'whatsapp', u.raw_user_meta_data->>'phone'),
      u.raw_user_meta_data->>'instagram_handle',
      COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
    INTO v_phone, v_instagram, v_name
    FROM auth.users u
    WHERE u.id = r.user_id;

    v_norm_phone := public.normalize_phone_simple(v_phone);

    -- Verificar se já existe um customer REAL com esse telefone
    IF v_norm_phone IS NOT NULL THEN
      SELECT id INTO v_real_customer_id
      FROM public.customers
      WHERE public.normalize_phone_simple(phone) = v_norm_phone
        AND id != r.shallow_id
      LIMIT 1;

      IF v_real_customer_id IS NOT NULL THEN
        -- Existe um customer real! Vincular o user_id a ele e deletar o raso
        UPDATE public.customers
        SET user_id = r.user_id,
            email = COALESCE(email, r.email),
            instagram_handle = COALESCE(instagram_handle, v_instagram),
            updated_at = now()
        WHERE id = v_real_customer_id;

        -- Vincular pedidos ao auth user
        UPDATE public.orders
        SET user_id = r.user_id
        WHERE customer_id = v_real_customer_id AND user_id IS NULL;

        -- Deletar o raso
        DELETE FROM public.customers WHERE id = r.shallow_id;
        RAISE NOTICE 'MERGED: shallow % -> real % (phone: %)', r.shallow_id, v_real_customer_id, v_phone;
      ELSE
        -- Não existe duplicata, apenas atualizar o raso com os dados corretos
        UPDATE public.customers
        SET phone = v_phone,
            name = COALESCE(v_name, name),
            instagram_handle = COALESCE(v_instagram, instagram_handle),
            updated_at = now()
        WHERE id = r.shallow_id;
        RAISE NOTICE 'UPDATED: % with phone %', r.shallow_id, v_phone;
      END IF;
    ELSE
      RAISE NOTICE 'NO PHONE for user %', r.user_id;
    END IF;
  END LOOP;
END $$;

-- STEP 3: Recalcular totais
UPDATE public.customers c
SET
  total_orders = COALESCE(sub.cnt, 0),
  total_spent = COALESCE(sub.total, 0),
  last_order_at = sub.last_at,
  updated_at = now()
FROM (
  SELECT
    customer_id,
    COUNT(*) AS cnt,
    COALESCE(SUM(CASE WHEN status IN ('pago','enviado','entregue') THEN total ELSE 0 END), 0) AS total,
    MAX(created_at) AS last_at
  FROM public.orders
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;
