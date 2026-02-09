-- Ensure we are using a normal VIEW (not materialized)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'product_available_stock'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.product_available_stock';
  END IF;
END
$$;

-- Centralized reserved stock calculator (Live carts + paid orders pending decrement)
CREATE OR REPLACE FUNCTION public.get_reserved_stock_map()
RETURNS TABLE(product_id uuid, size text, reserved integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH live_reserved AS (
    SELECT
      lci.product_id,
      COALESCE(
        NULLIF(lci.variante->>'tamanho', ''),
        NULLIF(lci.variante->>'tamanho_letra', ''),
        NULLIF(lci.variante->>'tamanho_numero', '')
      ) AS size,
      SUM(lci.qtd)::int AS qty
    FROM public.live_cart_items lci
    JOIN public.live_carts lc ON lc.id = lci.live_cart_id
    WHERE
      lci.status IN ('reservado', 'confirmado')
      AND lc.status NOT IN ('cancelado', 'expirado')
      AND lc.stock_decremented_at IS NULL
      AND (
        -- Explicitly reserve these operational states
        lc.operational_status IN ('aguardando_pagamento', 'cobrado', 'separado', 'aguardando_retorno')
        OR lc.operational_status LIKE 'aguardando_pagamento%'
        -- Also reserve paid carts until stock_decremented_at is set
        OR lc.status = 'pago'
        -- Defensive: if item is still marked reserved, count it
        OR lci.status = 'reservado'
      )
      AND COALESCE(
        NULLIF(lci.variante->>'tamanho', ''),
        NULLIF(lci.variante->>'tamanho_letra', ''),
        NULLIF(lci.variante->>'tamanho_numero', '')
      ) IS NOT NULL
    GROUP BY 1, 2
  ),
  order_reserved AS (
    SELECT
      oi.product_id,
      NULLIF(oi.size, '') AS size,
      SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE
      o.status = 'pago'
      AND o.stock_decremented_at IS NULL
      AND NULLIF(oi.size, '') IS NOT NULL
    GROUP BY 1, 2
  )
  SELECT
    product_id,
    size,
    SUM(qty)::int AS reserved
  FROM (
    SELECT product_id, size, qty FROM live_reserved
    UNION ALL
    SELECT product_id, size, qty FROM order_reserved
  ) t
  GROUP BY 1, 2;
$$;

-- Replace the centralized availability view
CREATE OR REPLACE VIEW public.product_available_stock AS
WITH stock_data AS (
  SELECT
    p.id AS product_id,
    size_key.key AS size,
    COALESCE(
      (COALESCE(p.erp_stock_by_size, p.stock_by_size, '{}'::jsonb) ->> size_key.key)::int,
      0
    ) AS on_hand,
    COALESCE((p.committed_by_size ->> size_key.key)::int, 0) AS committed
  FROM public.product_catalog p
  CROSS JOIN LATERAL jsonb_object_keys(
    COALESCE(p.erp_stock_by_size, p.stock_by_size, '{}'::jsonb)
  ) AS size_key(key)
),
reserved_data AS (
  SELECT * FROM public.get_reserved_stock_map()
)
SELECT
  sd.product_id,
  sd.size,
  sd.on_hand,
  sd.committed,
  COALESCE(rd.reserved, 0) AS reserved,
  GREATEST(0, (sd.on_hand - sd.committed - COALESCE(rd.reserved, 0))) AS available
FROM stock_data sd
LEFT JOIN reserved_data rd
  ON rd.product_id = sd.product_id AND rd.size = sd.size;

-- Ensure paid orders always mark stock_decremented_at when inventory movement exists
CREATE OR REPLACE FUNCTION public.apply_paid_effects(
  p_order_id uuid,
  p_confirmed_amount numeric DEFAULT NULL,
  p_paid_at timestamp with time zone DEFAULT NULL,
  p_gateway text DEFAULT 'mercado_pago'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_product RECORD;
  v_erpStock JSONB;
  v_committed JSONB;
  v_newCommitted JSONB;
  v_newDisplayStock JSONB;
  v_size TEXT;
  v_movement_exists BOOLEAN;
  v_items_decremented JSONB := '[]'::jsonb;
  v_actual_paid_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Idempotency via inventory_movements
  SELECT EXISTS(
    SELECT 1 FROM inventory_movements WHERE order_id = p_order_id
  ) INTO v_movement_exists;

  IF v_movement_exists THEN
    -- Backfill the flag so "paid-but-not-decremented" doesn't keep reserving forever
    UPDATE orders
    SET stock_decremented_at = COALESCE(stock_decremented_at, now()),
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'stock_decremented', false,
      'reason', 'Movement already exists (idempotent)',
      'order_id', p_order_id
    );
  END IF;

  v_actual_paid_at := COALESCE(p_paid_at, now());

  -- Update order fields; avoid re-setting status if it is already paid (prevents trigger recursion)
  IF v_order.status = 'pago' THEN
    UPDATE orders
    SET
      payment_status = 'approved',
      payment_confirmed_amount = COALESCE(p_confirmed_amount, total),
      paid_at = v_actual_paid_at,
      gateway = p_gateway,
      updated_at = now()
    WHERE id = p_order_id;
  ELSE
    UPDATE orders
    SET
      status = 'pago',
      payment_status = 'approved',
      payment_confirmed_amount = COALESCE(p_confirmed_amount, total),
      paid_at = v_actual_paid_at,
      gateway = p_gateway,
      updated_at = now()
    WHERE id = p_order_id;
  END IF;

  -- Decrement stock for each item (commit sold qty and recompute display stock)
  FOR v_item IN
    SELECT product_id, size, quantity
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    v_size := v_item.size;
    IF v_size IS NULL OR v_size = '' THEN
      CONTINUE;
    END IF;

    SELECT erp_stock_by_size, committed_by_size, stock_by_size
    INTO v_product
    FROM product_catalog
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_erpStock := COALESCE(v_product.erp_stock_by_size, v_product.stock_by_size, '{}'::jsonb);
    v_committed := COALESCE(v_product.committed_by_size, '{}'::jsonb);

    v_newCommitted := v_committed || jsonb_build_object(
      v_size, COALESCE((v_committed->>v_size)::int, 0) + v_item.quantity
    );

    v_newDisplayStock := '{}'::jsonb;
    FOR v_size IN SELECT jsonb_object_keys(v_erpStock)
    LOOP
      v_newDisplayStock := v_newDisplayStock || jsonb_build_object(
        v_size,
        GREATEST(0, COALESCE((v_erpStock->>v_size)::int, 0) - COALESCE((v_newCommitted->>v_size)::int, 0))
      );
    END LOOP;

    UPDATE product_catalog
    SET committed_by_size = v_newCommitted,
        stock_by_size = v_newDisplayStock
    WHERE id = v_item.product_id;

    v_items_decremented := v_items_decremented || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_item.size,
      'quantity', v_item.quantity
    );
  END LOOP;

  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (p_order_id, 'sale_decrement', v_items_decremented);

  UPDATE orders
  SET stock_decremented_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'stock_decremented', true,
    'items', v_items_decremented
  );
END;
$$;

-- Trigger paid effects on manual status change to 'pago'
CREATE OR REPLACE FUNCTION public.trigger_apply_paid_effects_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status <> 'pago') THEN
    PERFORM public.apply_paid_effects(
      NEW.id,
      NEW.payment_confirmed_amount,
      NEW.paid_at,
      COALESCE(NEW.gateway, 'mercado_pago')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_apply_paid_effects_on_paid ON public.orders;
CREATE TRIGGER orders_apply_paid_effects_on_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_apply_paid_effects_on_paid();

-- Ensure live carts also decrement stock when marked as paid
DROP TRIGGER IF EXISTS live_carts_apply_paid_effects_on_paid ON public.live_carts;
CREATE TRIGGER live_carts_apply_paid_effects_on_paid
AFTER UPDATE OF status ON public.live_carts
FOR EACH ROW
WHEN (NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM NEW.status))
EXECUTE FUNCTION public.trigger_apply_live_cart_paid_effects();
