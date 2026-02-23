-- Fix catalog paid flow leaving committed qty after stock decrement.
-- Symptom: stock_by_size is decremented on paid, but committed_by_size can remain > 0
-- when the reservation movement is missing/not found, causing available = 0 incorrectly.
--
-- This patch keeps current decrement strategy (real stock reduction on paid),
-- but guarantees committed_by_size is also reduced in all paid paths.

CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_current_stock JSONB;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement RECORD;
  v_items_array JSONB := '[]'::jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.stock_decremented_at IS NOT NULL THEN RETURN NEW; END IF;

    -- Skip live orders already decremented
    IF NEW.source = 'live' AND NEW.live_cart_id IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM live_carts WHERE id = NEW.live_cart_id AND stock_decremented_at IS NOT NULL) THEN
        NEW.stock_decremented_at := now();
        RETURN NEW;
      END IF;
      IF EXISTS(SELECT 1 FROM inventory_movements WHERE order_id = NEW.live_cart_id AND movement_type IN ('live_sale_committed', 'live_sale_decrement')) THEN
        NEW.stock_decremented_at := now();
        RETURN NEW;
      END IF;
    END IF;

    -- Check for existing reservation
    SELECT * INTO v_movement
    FROM inventory_movements
    WHERE order_id = NEW.id AND movement_type = 'reservation'
    LIMIT 1;

    IF FOUND THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_movement.items_json)
      LOOP
        v_size := v_item.value->>'size';
        v_qty := COALESCE((v_item.value->>'qty')::int, (v_item.value->>'quantity')::int, 0);
        IF v_size IS NULL OR v_size = '' OR v_qty = 0 THEN CONTINUE; END IF;

        SELECT stock_by_size, committed_by_size INTO v_current_stock, v_current_committed
        FROM product_catalog WHERE id = (v_item.value->>'product_id')::uuid FOR UPDATE;

        v_current_stock := COALESCE(v_current_stock, '{}'::jsonb);
        v_current_committed := COALESCE(v_current_committed, '{}'::jsonb);

        v_current_stock := jsonb_set(
          v_current_stock,
          ARRAY[v_size],
          to_jsonb(GREATEST(0, COALESCE((v_current_stock->>v_size)::int, 0) - v_qty))
        );

        -- Reservation is being fulfilled: remove from committed too.
        v_current_committed := jsonb_set(
          v_current_committed,
          ARRAY[v_size],
          to_jsonb(GREATEST(0, COALESCE((v_current_committed->>v_size)::int, 0) - v_qty))
        );

        UPDATE product_catalog
        SET stock_by_size = v_current_stock, committed_by_size = v_current_committed
        WHERE id = (v_item.value->>'product_id')::uuid;
      END LOOP;

      UPDATE inventory_movements SET movement_type = 'sale_committed' WHERE id = v_movement.id;
      NEW.stock_decremented_at := now();
      RETURN NEW;
    END IF;

    -- No reservation movement found: decrement stock and also clear any committed remainder.
    FOR v_item IN SELECT oi.product_id, oi.size, oi.quantity FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      v_size := v_item.size;
      v_qty := v_item.quantity;
      IF v_size IS NULL OR v_size = '' THEN CONTINUE; END IF;

      SELECT stock_by_size, committed_by_size INTO v_current_stock, v_current_committed
      FROM product_catalog WHERE id = v_item.product_id FOR UPDATE;

      IF FOUND THEN
        v_current_stock := COALESCE(v_current_stock, '{}'::jsonb);
        v_current_committed := COALESCE(v_current_committed, '{}'::jsonb);

        v_current_stock := jsonb_set(
          v_current_stock,
          ARRAY[v_size],
          to_jsonb(GREATEST(0, COALESCE((v_current_stock->>v_size)::int, 0) - v_qty))
        );

        v_current_committed := jsonb_set(
          v_current_committed,
          ARRAY[v_size],
          to_jsonb(GREATEST(0, COALESCE((v_current_committed->>v_size)::int, 0) - v_qty))
        );

        UPDATE product_catalog
        SET stock_by_size = v_current_stock, committed_by_size = v_current_committed
        WHERE id = v_item.product_id;

        v_items_array := v_items_array || jsonb_build_object('product_id', v_item.product_id, 'size', v_size, 'qty', v_qty);
      END IF;
    END LOOP;

    IF jsonb_array_length(v_items_array) > 0 THEN
      INSERT INTO inventory_movements (order_id, movement_type, items_json)
      VALUES (NEW.id, 'sale_committed', v_items_array)
      ON CONFLICT (order_id) DO UPDATE SET movement_type = 'sale_committed', items_json = EXCLUDED.items_json;
    END IF;

    NEW.stock_decremented_at := now();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
