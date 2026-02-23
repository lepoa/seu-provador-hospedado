-- Fix pending catalog orders being shown as "sold" in stock tooltip.
--
-- Root cause:
-- reserve_order_stock() was writing committed_by_size at reservation time
-- (status aguardando_pagamento). The UI interprets committed as sold.
--
-- Fix:
-- 1) reserve_order_stock now ONLY records reservation movement.
-- 2) one-time reconciliation removes pending reservation qty from committed_by_size.

CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_size TEXT;
  v_qty INT;
  v_items_array JSONB := '[]'::jsonb;
  v_movement_exists BOOLEAN;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status <> 'aguardando_pagamento' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Not aguardando_pagamento');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.inventory_movements
    WHERE order_id = p_order_id
      AND movement_type = 'reservation'
  ) INTO v_movement_exists;

  IF v_movement_exists THEN
    RETURN jsonb_build_object('success', true, 'already_reserved', true);
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.size, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    v_size := upper(btrim(v_item.size));
    v_qty := COALESCE(v_item.quantity, 0);

    IF v_item.product_id IS NULL OR v_size IS NULL OR v_size = '' OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_items_array := v_items_array || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_size,
      'qty', v_qty
    );
  END LOOP;

  IF jsonb_array_length(v_items_array) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order has no valid items');
  END IF;

  INSERT INTO public.inventory_movements (order_id, movement_type, items_json)
  VALUES (p_order_id, 'reservation', v_items_array);

  RETURN jsonb_build_object('success', true, 'reserved', true, 'items', v_items_array);
END;
$fn$;

DO $$
DECLARE
  v_row RECORD;
  v_committed JSONB;
  v_key TEXT;
  v_found_key BOOLEAN;
BEGIN
  -- Reconcile historical pending reservations that were previously written into committed_by_size.
  FOR v_row IN
    SELECT
      x.product_id,
      upper(btrim(x.size_raw)) AS size_norm,
      SUM(x.qty)::int AS total_qty
    FROM (
      SELECT
        (ji->>'product_id')::uuid AS product_id,
        COALESCE(NULLIF(ji->>'size', ''), NULLIF(ji->>'tamanho', '')) AS size_raw,
        COALESCE(
          CASE WHEN COALESCE(ji->>'qty', '') ~ '^[0-9]+$' THEN (ji->>'qty')::int ELSE NULL END,
          CASE WHEN COALESCE(ji->>'quantity', '') ~ '^[0-9]+$' THEN (ji->>'quantity')::int ELSE NULL END,
          CASE WHEN COALESCE(ji->>'qtd', '') ~ '^[0-9]+$' THEN (ji->>'qtd')::int ELSE NULL END,
          0
        ) AS qty
      FROM public.orders o
      JOIN public.inventory_movements im
        ON im.order_id = o.id
       AND im.movement_type = 'reservation'
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(im.items_json, '[]'::jsonb)) AS ji
      WHERE o.status NOT IN ('pago', 'cancelado', 'expirado', 'pagamento_rejeitado', 'reembolsado', 'entregue')
        AND o.stock_decremented_at IS NULL
    ) x
    WHERE x.product_id IS NOT NULL
      AND x.size_raw IS NOT NULL
      AND btrim(x.size_raw) <> ''
      AND x.qty > 0
    GROUP BY x.product_id, upper(btrim(x.size_raw))
  LOOP
    SELECT committed_by_size
      INTO v_committed
      FROM public.product_catalog
     WHERE id = v_row.product_id
     FOR UPDATE;

    v_committed := COALESCE(v_committed, '{}'::jsonb);
    v_found_key := false;

    FOR v_key IN
      SELECT key_name
      FROM jsonb_object_keys(v_committed) AS t(key_name)
      WHERE upper(btrim(key_name)) = v_row.size_norm
    LOOP
      v_found_key := true;
      v_committed := jsonb_set(
        v_committed,
        ARRAY[v_key],
        to_jsonb(GREATEST(0, COALESCE((v_committed->>v_key)::int, 0) - v_row.total_qty)),
        false
      );
    END LOOP;

    IF NOT v_found_key THEN
      v_committed := jsonb_set(
        v_committed,
        ARRAY[v_row.size_norm],
        to_jsonb(0),
        true
      );
    END IF;

    UPDATE public.product_catalog
       SET committed_by_size = v_committed
     WHERE id = v_row.product_id;
  END LOOP;
END;
$$;
