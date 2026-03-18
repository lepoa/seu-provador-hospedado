-- =======================================================
-- VINCULAR PEDIDOS AOS CLIENTES CORRETOS POR TELEFONE
-- E RECALCULAR TOTAIS
-- =======================================================

-- STEP 1: Para pedidos que têm customer_phone mas apontam pra um customer 
-- diferente do que tem user_id, re-vincular pelo telefone
DO $$
DECLARE
  r RECORD;
  v_correct_customer_id UUID;
BEGIN
  FOR r IN
    SELECT o.id AS order_id, o.customer_id AS old_customer_id, 
           o.customer_phone, o.user_id AS order_user_id
    FROM public.orders o
    WHERE o.customer_phone IS NOT NULL
  LOOP
    -- Buscar o customer correto pelo telefone normalizado
    SELECT id INTO v_correct_customer_id
    FROM public.customers
    WHERE public.normalize_phone_simple(phone) = public.normalize_phone_simple(r.customer_phone)
      AND user_id IS NOT NULL  -- preferir o que tem auth vinculado
    ORDER BY user_id IS NOT NULL DESC, created_at ASC
    LIMIT 1;

    -- Se encontrou e é diferente do atual, atualizar
    IF v_correct_customer_id IS NOT NULL AND v_correct_customer_id != r.old_customer_id THEN
      UPDATE public.orders
      SET customer_id = v_correct_customer_id
      WHERE id = r.order_id;
      
      RAISE NOTICE 'Order % relinked: % -> %', r.order_id, r.old_customer_id, v_correct_customer_id;
    END IF;
  END LOOP;
END $$;

-- STEP 2: Deletar customers órfãos (sem user_id e sem pedidos vinculados)
DELETE FROM public.customers
WHERE user_id IS NULL
  AND id NOT IN (SELECT DISTINCT customer_id FROM public.orders WHERE customer_id IS NOT NULL);

-- STEP 3: Recalcular total_orders e total_spent
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
