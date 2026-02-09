
-- 1) RPC to reserve stock when order is created as aguardando_pagamento
CREATE OR REPLACE FUNCTION public.reserve_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_items_array JSONB := '[]'::jsonb;
  v_movement_exists BOOLEAN;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status != 'aguardando_pagamento' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Not aguardando_pagamento');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM inventory_movements 
    WHERE order_id = p_order_id AND movement_type = 'reservation'
  ) INTO v_movement_exists;

  IF v_movement_exists THEN
    RETURN jsonb_build_object('success', true, 'already_reserved', true);
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.size, oi.quantity
    FROM order_items oi WHERE oi.order_id = p_order_id
  LOOP
    v_size := v_item.size;
    v_qty := v_item.quantity;
    IF v_size IS NULL OR v_size = '' THEN CONTINUE; END IF;

    SELECT committed_by_size INTO v_committed
    FROM product_catalog WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_committed := COALESCE(v_committed, '{}'::jsonb);
    v_committed := jsonb_set(v_committed, ARRAY[v_size],
      to_jsonb(COALESCE((v_committed->>v_size)::int, 0) + v_qty));

    UPDATE product_catalog SET committed_by_size = v_committed WHERE id = v_item.product_id;

    v_items_array := v_items_array || jsonb_build_object(
      'product_id', v_item.product_id, 'size', v_size, 'qty', v_qty);
  END LOOP;

  IF jsonb_array_length(v_items_array) > 0 THEN
    INSERT INTO inventory_movements (order_id, movement_type, items_json)
    VALUES (p_order_id, 'reservation', v_items_array);
  END IF;

  RETURN jsonb_build_object('success', true, 'reserved', true, 'items', v_items_array);
END;
$fn$;

-- 2) Update handle_order_paid: skip double-commit if reservation exists
CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_items_synced BOOLEAN;
  v_items_count INT;
  v_item RECORD;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement_exists BOOLEAN;
  v_reservation_exists BOOLEAN;
  v_items_array JSONB := '[]'::jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status = 'pago' OR NEW.status != 'pago') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.status != 'pago' THEN RETURN NEW; END IF;
  IF NEW.stock_decremented_at IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.source = 'live' AND NEW.live_cart_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM live_carts WHERE id = NEW.live_cart_id AND stock_decremented_at IS NOT NULL) THEN
      NEW.stock_decremented_at := (SELECT stock_decremented_at FROM live_carts WHERE id = NEW.live_cart_id);
      RETURN NEW;
    END IF;
    IF EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = NEW.live_cart_id AND movement_type IN ('live_sale_committed', 'live_sale_decrement')) THEN
      NEW.stock_decremented_at := now();
      RETURN NEW;
    END IF;
  END IF;

  v_items_synced := ensure_order_items_for_live_order(NEW.id);
  SELECT COUNT(*) INTO v_items_count FROM order_items WHERE order_id = NEW.id;
  IF v_items_count = 0 THEN
    RAISE WARNING 'Order % has no items.', NEW.id;
    RETURN NEW;
  END IF;

  SELECT EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = NEW.id AND movement_type = 'sale_committed') INTO v_movement_exists;
  IF v_movement_exists THEN
    NEW.stock_decremented_at := now();
    RETURN NEW;
  END IF;

  -- If reservation exists, just upgrade it (stock already committed)
  SELECT EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = NEW.id AND movement_type = 'reservation') INTO v_reservation_exists;
  IF v_reservation_exists THEN
    UPDATE inventory_movements SET movement_type = 'sale_committed' WHERE order_id = NEW.id AND movement_type = 'reservation';
    NEW.stock_decremented_at := now();
    RETURN NEW;
  END IF;

  -- No prior reservation - commit now
  FOR v_item IN SELECT oi.product_id, oi.size, oi.quantity FROM order_items oi WHERE oi.order_id = NEW.id
  LOOP
    v_size := v_item.size;
    v_qty := v_item.quantity;
    IF v_size IS NULL OR v_size = '' THEN CONTINUE; END IF;

    SELECT committed_by_size INTO v_current_committed FROM product_catalog WHERE id = v_item.product_id FOR UPDATE;
    IF FOUND THEN
      v_current_committed := COALESCE(v_current_committed, '{}'::jsonb);
      v_current_committed := jsonb_set(v_current_committed, ARRAY[v_size], to_jsonb(COALESCE((v_current_committed->>v_size)::int, 0) + v_qty));
      UPDATE product_catalog SET committed_by_size = v_current_committed WHERE id = v_item.product_id;
      v_items_array := v_items_array || jsonb_build_object('product_id', v_item.product_id, 'size', v_size, 'qty', v_qty);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_items_array) > 0 THEN
    INSERT INTO inventory_movements (order_id, movement_type, items_json) VALUES (NEW.id, 'sale_committed', v_items_array)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  NEW.stock_decremented_at := now();
  RETURN NEW;
END;
$fn$;

-- 3) Revert stock on cancel: handle reservation movements too
CREATE OR REPLACE FUNCTION public.revert_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_item RECORD;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement RECORD;
BEGIN
  IF NEW.status NOT IN ('cancelado', 'expirado', 'pagamento_rejeitado') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT * INTO v_movement
  FROM inventory_movements
  WHERE order_id = NEW.id AND movement_type IN ('reservation', 'sale_committed')
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_movement.items_json) AS item
  LOOP
    v_size := v_item.item->>'size';
    v_qty := COALESCE((v_item.item->>'qty')::int, (v_item.item->>'quantity')::int, 0);
    IF v_size IS NULL OR v_size = '' OR v_qty = 0 THEN CONTINUE; END IF;

    SELECT committed_by_size INTO v_current_committed
    FROM product_catalog WHERE id = (v_item.item->>'product_id')::uuid FOR UPDATE;

    IF v_current_committed IS NOT NULL THEN
      v_current_committed := jsonb_set(v_current_committed, ARRAY[v_size],
        to_jsonb(GREATEST(0, COALESCE((v_current_committed->>v_size)::int, 0) - v_qty)));
      UPDATE product_catalog SET committed_by_size = v_current_committed
      WHERE id = (v_item.item->>'product_id')::uuid;
    END IF;
  END LOOP;

  UPDATE inventory_movements SET movement_type = 'reservation_reverted'
  WHERE order_id = NEW.id AND movement_type IN ('reservation', 'sale_committed');

  NEW.stock_decremented_at := NULL;
  RETURN NEW;
END;
$fn$;

-- 4) Update catalog reservation to 24 hours
CREATE OR REPLACE FUNCTION public.set_order_reserved_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_reservation_minutes int;
BEGIN
  IF NEW.status = 'aguardando_pagamento' THEN
    IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'aguardando_pagamento') THEN
      IF NEW.source = 'live' AND NEW.live_event_id IS NOT NULL THEN
        SELECT reservation_expiry_minutes INTO v_reservation_minutes
        FROM live_events WHERE id = NEW.live_event_id;
        v_reservation_minutes := COALESCE(v_reservation_minutes, 10080);
        NEW.reserved_until := now() + (v_reservation_minutes || ' minutes')::interval;
      ELSIF NEW.source = 'catalog' OR NEW.source IS NULL THEN
        NEW.reserved_until := now() + interval '24 hours';
      ELSE
        IF NEW.reserved_until IS NULL THEN
          NEW.reserved_until := now() + interval '24 hours';
        END IF;
      END IF;
    END IF;
  END IF;

  IF NEW.status IN ('pago', 'cancelado', 'entregue', 'expirado') THEN
    NEW.reserved_until := NULL;
  END IF;

  RETURN NEW;
END;
$fn$;

-- 5) Function to expire pending orders
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_expired_count INT;
BEGIN
  UPDATE orders
  SET status = 'cancelado',
      cancel_reason = 'Reserva expirada automaticamente',
      updated_at = now()
  WHERE status = 'aguardando_pagamento'
    AND reserved_until IS NOT NULL
    AND reserved_until < now();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN jsonb_build_object('expired_count', v_expired_count);
END;
$fn$;
