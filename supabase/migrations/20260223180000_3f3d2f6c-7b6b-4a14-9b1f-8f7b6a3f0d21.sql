-- Stock lifecycle stabilization (catalog + live):
-- - Pending orders/carts => RESERVED
-- - Paid and downstream => SOLD (committed)
-- - Cancellation/expiry/rejection/refund => release reservation/sold
-- - Default reservation window: 24h
-- - Optional status "manter_na_reserva" keeps hold without auto-expiry

-- 0) Defensive cleanup of legacy stock triggers that conflict with this model.
DROP TRIGGER IF EXISTS trigger_decrement_stock_on_paid ON public.orders;
DROP TRIGGER IF EXISTS trigger_handle_order_paid ON public.orders;
DROP TRIGGER IF EXISTS orders_apply_paid_effects_on_paid ON public.orders;
DROP TRIGGER IF EXISTS trigger_revert_stock_on_cancel ON public.orders;
DROP TRIGGER IF EXISTS zzz_orders_catalog_paid_committed_guard ON public.orders;

DROP FUNCTION IF EXISTS public.normalize_catalog_paid_committed();

-- 1) Canonical helper: adjust committed_by_size with normalized size keys.
CREATE OR REPLACE FUNCTION public.adjust_committed_by_size(
  p_product_id uuid,
  p_size text,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size_norm text;
  v_current jsonb;
  v_normalized jsonb := '{}'::jsonb;
  v_pair record;
  v_key text;
  v_value_int integer;
  v_current_qty integer;
BEGIN
  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  v_size_norm := upper(btrim(COALESCE(p_size, '')));
  IF v_size_norm = '' THEN
    RETURN;
  END IF;

  SELECT committed_by_size
    INTO v_current
    FROM public.product_catalog
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_current := COALESCE(v_current, '{}'::jsonb);

  -- Normalize all existing keys (trim + upper) and aggregate duplicates.
  FOR v_pair IN
    SELECT key, value
    FROM jsonb_each_text(v_current)
  LOOP
    v_key := upper(btrim(COALESCE(v_pair.key, '')));
    IF v_key = '' THEN
      CONTINUE;
    END IF;

    IF COALESCE(v_pair.value, '') ~ '^-?[0-9]+$' THEN
      v_value_int := (v_pair.value)::integer;
    ELSE
      v_value_int := 0;
    END IF;

    v_normalized := jsonb_set(
      v_normalized,
      ARRAY[v_key],
      to_jsonb(COALESCE((v_normalized->>v_key)::integer, 0) + v_value_int),
      true
    );
  END LOOP;

  v_current_qty := COALESCE((v_normalized->>v_size_norm)::integer, 0);
  v_normalized := jsonb_set(
    v_normalized,
    ARRAY[v_size_norm],
    to_jsonb(GREATEST(0, v_current_qty + p_delta)),
    true
  );

  UPDATE public.product_catalog
     SET committed_by_size = v_normalized
   WHERE id = p_product_id;
END;
$$;

-- 2) Commit sold quantity for an order (idempotent).
CREATE OR REPLACE FUNCTION public.commit_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_movement record;
  v_item record;
  v_size text;
  v_qty integer;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order id is required');
  END IF;

  SELECT id, movement_type, items_json
    INTO v_existing_movement
    FROM public.inventory_movements
   WHERE order_id = p_order_id
   FOR UPDATE;

  IF FOUND AND v_existing_movement.movement_type IN ('sale_committed', 'live_sale_committed', 'live_sale_decrement', 'sale_decrement') THEN
    RETURN jsonb_build_object('success', true, 'already_committed', true);
  END IF;

  -- Prefer existing reservation payload for exact reservation->sale handoff.
  IF FOUND AND v_existing_movement.movement_type = 'reservation' THEN
    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_existing_movement.items_json, '[]'::jsonb))
    LOOP
      v_size := upper(btrim(COALESCE(v_item.value->>'size', v_item.value->>'tamanho', '')));
      v_qty := COALESCE(
        CASE WHEN COALESCE(v_item.value->>'qty', '') ~ '^[0-9]+$' THEN (v_item.value->>'qty')::integer ELSE NULL END,
        CASE WHEN COALESCE(v_item.value->>'quantity', '') ~ '^[0-9]+$' THEN (v_item.value->>'quantity')::integer ELSE NULL END,
        CASE WHEN COALESCE(v_item.value->>'qtd', '') ~ '^[0-9]+$' THEN (v_item.value->>'qtd')::integer ELSE NULL END,
        0
      );

      IF v_size = '' OR v_qty <= 0 OR (v_item.value->>'product_id') IS NULL THEN
        CONTINUE;
      END IF;

      v_items := v_items || jsonb_build_object(
        'product_id', (v_item.value->>'product_id')::uuid,
        'size', v_size,
        'qty', v_qty
      );
    END LOOP;
  ELSE
    -- Fallback from order_items.
    FOR v_item IN
      SELECT oi.product_id, oi.size, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
    LOOP
      v_size := upper(btrim(COALESCE(v_item.size, '')));
      v_qty := COALESCE(v_item.quantity, 0);

      IF v_item.product_id IS NULL OR v_size = '' OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_items := v_items || jsonb_build_object(
        'product_id', v_item.product_id,
        'size', v_size,
        'qty', v_qty
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order has no valid items');
  END IF;

  -- Apply sold increments (committed).
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_items)
  LOOP
    PERFORM public.adjust_committed_by_size(
      (v_item.value->>'product_id')::uuid,
      v_item.value->>'size',
      (v_item.value->>'qty')::integer
    );
  END LOOP;

  INSERT INTO public.inventory_movements (order_id, movement_type, items_json)
  VALUES (p_order_id, 'sale_committed', v_items)
  ON CONFLICT (order_id) DO UPDATE
    SET movement_type = 'sale_committed',
        items_json = EXCLUDED.items_json;

  RETURN jsonb_build_object('success', true, 'committed', true, 'items', v_items);
END;
$$;

-- 3) Reserve stock for pending CATALOG orders (idempotent / recalculable).
CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_existing_movement record;
  v_item record;
  v_size text;
  v_qty integer;
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT *
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Live reservations are managed by live_carts/live_cart_items.
  IF COALESCE(v_order.source, 'catalog') = 'live' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Live order managed by live cart reservation');
  END IF;

  IF v_order.stock_decremented_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Order already committed');
  END IF;

  IF v_order.status NOT IN ('aguardando_pagamento', 'pendente', 'aguardando_retorno', 'aguardando_validacao_pagamento', 'manter_na_reserva') THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Order status does not reserve stock');
  END IF;

  IF v_order.status <> 'manter_na_reserva'
     AND v_order.reserved_until IS NOT NULL
     AND v_order.reserved_until <= now() THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Reservation already expired');
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.size, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    v_size := upper(btrim(COALESCE(v_item.size, '')));
    v_qty := COALESCE(v_item.quantity, 0);

    IF v_item.product_id IS NULL OR v_size = '' OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_items := v_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_size,
      'qty', v_qty
    );
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order has no valid items');
  END IF;

  SELECT id, movement_type
    INTO v_existing_movement
    FROM public.inventory_movements
   WHERE order_id = p_order_id
   FOR UPDATE;

  IF FOUND AND v_existing_movement.movement_type IN ('sale_committed', 'live_sale_committed', 'live_sale_decrement', 'sale_decrement') THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Order already sold/committed');
  END IF;

  INSERT INTO public.inventory_movements (order_id, movement_type, items_json)
  VALUES (p_order_id, 'reservation', v_items)
  ON CONFLICT (order_id) DO UPDATE
    SET movement_type = 'reservation',
        items_json = EXCLUDED.items_json;

  RETURN jsonb_build_object('success', true, 'reserved', true, 'items', v_items);
END;
$$;

-- 4) Trigger path for admin/manual status change to paid (catalog only).
CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commit_result jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.syncing_live_cart', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Skip when payment is being processed via apply_paid_effects() RPC.
  IF current_setting('app.apply_paid_effects', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'pago' OR OLD.status = 'pago' THEN
    RETURN NEW;
  END IF;

  -- Live flow has its own paid effects path.
  IF COALESCE(NEW.source, 'catalog') = 'live' THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_decremented_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.commit_order_stock(NEW.id)
    INTO v_commit_result;

  IF COALESCE((v_commit_result->>'success')::boolean, false) THEN
    NEW.stock_decremented_at := COALESCE(NEW.stock_decremented_at, now());
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Keep apply_paid_effects aligned with trigger behavior and idempotency.
CREATE OR REPLACE FUNCTION public.apply_paid_effects(
  p_order_id uuid,
  p_confirmed_amount numeric DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_gateway text DEFAULT 'mercado_pago'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_paid_at timestamptz;
  v_commit_result jsonb;
BEGIN
  SELECT *
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_paid_at := COALESCE(p_paid_at, now());

  IF v_order.status = 'pago' AND v_order.stock_decremented_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true, 'order_id', p_order_id);
  END IF;

  -- Prevent handle_order_paid trigger from duplicating effects during this controlled update.
  PERFORM set_config('app.apply_paid_effects', 'true', true);

  UPDATE public.orders
     SET status = 'pago',
         payment_status = 'approved',
         payment_confirmed_amount = COALESCE(p_confirmed_amount, total),
         paid_at = v_paid_at,
         gateway = COALESCE(p_gateway, gateway),
         updated_at = now()
   WHERE id = p_order_id;

  SELECT public.commit_order_stock(p_order_id)
    INTO v_commit_result;

  IF COALESCE((v_commit_result->>'success')::boolean, false) THEN
    UPDATE public.orders
       SET stock_decremented_at = COALESCE(stock_decremented_at, now())
     WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', COALESCE((v_commit_result->>'success')::boolean, false),
    'order_id', p_order_id,
    'stock_committed', COALESCE((v_commit_result->>'committed')::boolean, false),
    'commit_result', v_commit_result
  );
END;
$$;

-- 6) Revert reservation/sold on cancellation-like statuses.
CREATE OR REPLACE FUNCTION public.revert_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement record;
  v_item record;
  v_size text;
  v_qty integer;
BEGIN
  IF NEW.status NOT IN ('cancelado', 'expirado', 'pagamento_rejeitado', 'reembolsado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT id, movement_type, items_json
    INTO v_movement
    FROM public.inventory_movements
   WHERE order_id = NEW.id
   LIMIT 1;

  -- Some live flows use live_cart_id as inventory movement key.
  IF NOT FOUND AND NEW.live_cart_id IS NOT NULL THEN
    SELECT id, movement_type, items_json
      INTO v_movement
      FROM public.inventory_movements
     WHERE order_id = NEW.live_cart_id
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    NEW.stock_decremented_at := NULL;
    RETURN NEW;
  END IF;

  IF v_movement.movement_type IN ('sale_committed', 'live_sale_committed', 'live_sale_decrement', 'sale_decrement') THEN
    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_movement.items_json, '[]'::jsonb))
    LOOP
      v_size := upper(btrim(COALESCE(v_item.value->>'size', v_item.value->>'tamanho', '')));
      v_qty := COALESCE(
        CASE WHEN COALESCE(v_item.value->>'qty', '') ~ '^[0-9]+$' THEN (v_item.value->>'qty')::integer ELSE NULL END,
        CASE WHEN COALESCE(v_item.value->>'quantity', '') ~ '^[0-9]+$' THEN (v_item.value->>'quantity')::integer ELSE NULL END,
        CASE WHEN COALESCE(v_item.value->>'qtd', '') ~ '^[0-9]+$' THEN (v_item.value->>'qtd')::integer ELSE NULL END,
        0
      );

      IF v_size = '' OR v_qty <= 0 OR (v_item.value->>'product_id') IS NULL THEN
        CONTINUE;
      END IF;

      PERFORM public.adjust_committed_by_size(
        (v_item.value->>'product_id')::uuid,
        v_size,
        -v_qty
      );
    END LOOP;

    UPDATE public.inventory_movements
       SET movement_type = 'sale_reverted'
     WHERE id = v_movement.id;
  ELSE
    UPDATE public.inventory_movements
       SET movement_type = 'reservation_reverted'
     WHERE id = v_movement.id;
  END IF;

  NEW.stock_decremented_at := NULL;
  RETURN NEW;
END;
$$;

-- 7) Reserved-until policy (24h default, with optional hold status).
CREATE OR REPLACE FUNCTION public.set_order_reserved_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'manter_na_reserva' THEN
    NEW.reserved_until := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('aguardando_pagamento', 'pendente', 'aguardando_retorno', 'aguardando_validacao_pagamento') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.reserved_until := COALESCE(NEW.reserved_until, now() + interval '24 hours');
    ELSIF NEW.reserved_until IS NULL THEN
      NEW.reserved_until := now() + interval '24 hours';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('pago', 'cancelado', 'expirado', 'pagamento_rejeitado', 'reembolsado', 'entregue') THEN
    NEW.reserved_until := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_reserved_until_on_order ON public.orders;
DROP TRIGGER IF EXISTS trg_set_order_reserved_until ON public.orders;
CREATE TRIGGER set_reserved_until_on_order
BEFORE INSERT OR UPDATE OF status, reserved_until ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_reserved_until();

-- 8) Ensure reservation movement stays in sync when pending orders/items change.
CREATE OR REPLACE FUNCTION public.ensure_order_reservation_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_order_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  IF v_order_id IS NOT NULL THEN
    PERFORM public.reserve_order_stock(v_order_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_ensure_reservation ON public.orders;
CREATE TRIGGER trg_orders_ensure_reservation
AFTER INSERT OR UPDATE OF status, stock_decremented_at, reserved_until ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_reservation_sync();

DROP TRIGGER IF EXISTS trg_order_items_ensure_reservation ON public.order_items;
CREATE TRIGGER trg_order_items_ensure_reservation
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_reservation_sync();

-- 9) Reservation map used by product_available_stock.
CREATE OR REPLACE FUNCTION public.get_reserved_stock_map()
RETURNS TABLE(product_id uuid, size text, reserved integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH live_reserved AS (
  SELECT
    lci.product_id,
    upper(btrim(COALESCE(NULLIF(lci.variante->>'size', ''), NULLIF(lci.variante->>'tamanho', ''), 'UNICO'))) AS size_key,
    SUM(lci.qtd)::int AS qty
  FROM public.live_cart_items lci
  JOIN public.live_carts lc ON lc.id = lci.live_cart_id
  WHERE lci.status IN ('reservado', 'confirmado')
    AND lc.status NOT IN ('pago', 'cancelado', 'expirado')
    AND lc.stock_decremented_at IS NULL
  GROUP BY lci.product_id, upper(btrim(COALESCE(NULLIF(lci.variante->>'size', ''), NULLIF(lci.variante->>'tamanho', ''), 'UNICO')))
),
order_reserved AS (
  SELECT
    oi.product_id,
    upper(btrim(COALESCE(NULLIF(oi.size, ''), 'UNICO'))) AS size_key,
    SUM(oi.quantity)::int AS qty
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE COALESCE(o.source, 'catalog') <> 'live'
    AND o.stock_decremented_at IS NULL
    AND o.status NOT IN ('cancelado', 'pago', 'pagamento_rejeitado', 'reembolsado', 'expirado', 'entregue')
    AND (
      o.status = 'manter_na_reserva'
      OR o.reserved_until IS NULL
      OR o.reserved_until > now()
    )
  GROUP BY oi.product_id, upper(btrim(COALESCE(NULLIF(oi.size, ''), 'UNICO')))
),
combined AS (
  SELECT * FROM live_reserved
  UNION ALL
  SELECT * FROM order_reserved
)
SELECT
  c.product_id,
  c.size_key AS size,
  SUM(c.qty)::int AS reserved
FROM combined c
WHERE c.product_id IS NOT NULL
  AND c.size_key IS NOT NULL
  AND c.size_key <> ''
  AND c.qty > 0
GROUP BY c.product_id, c.size_key;
$$;

-- 10) Auto-expire pending orders after 24h (unless manually kept on hold).
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  UPDATE public.orders
     SET status = 'expirado',
         cancel_reason = 'Reserva expirada automaticamente (24h)',
         updated_at = now()
   WHERE COALESCE(source, 'catalog') <> 'live'
     AND stock_decremented_at IS NULL
     AND status IN ('aguardando_pagamento', 'pendente', 'aguardando_retorno', 'aguardando_validacao_pagamento')
     AND reserved_until IS NOT NULL
     AND reserved_until < now();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN jsonb_build_object('expired_count', v_expired_count);
END;
$$;

-- 11) Backfill reserved_until for currently pending catalog orders.
UPDATE public.orders
   SET reserved_until = now() + interval '24 hours'
 WHERE COALESCE(source, 'catalog') <> 'live'
   AND stock_decremented_at IS NULL
   AND status IN ('aguardando_pagamento', 'pendente', 'aguardando_retorno', 'aguardando_validacao_pagamento')
   AND reserved_until IS NULL;

-- 12) Ensure canonical order triggers are active with updated functions.
DROP TRIGGER IF EXISTS trg_order_paid ON public.orders;
CREATE TRIGGER trg_order_paid
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_paid();

DROP TRIGGER IF EXISTS trg_order_cancel_revert ON public.orders;
CREATE TRIGGER trg_order_cancel_revert
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_stock_on_cancel();
