
-- ============================================================
-- FIX: Attach triggers to orders table + fix stock decrement on paid
-- ============================================================

-- 1) Recreate handle_order_paid to ALSO decrement stock_by_size
CREATE OR REPLACE FUNCTION handle_order_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_current_stock JSONB;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement RECORD;
  v_items_array JSONB := '[]'::jsonb;
BEGIN
  -- Guard: only fire once, skip recursive
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF current_setting('app.syncing_live_cart', true) = 'true' THEN RETURN NEW; END IF;

  -- Only act on transition TO 'pago'
  IF TG_OP = 'UPDATE' AND NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- Already processed?
    IF NEW.stock_decremented_at IS NOT NULL THEN RETURN NEW; END IF;

    -- Skip live orders that were already decremented via live_carts
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

    -- Check for existing reservation movement
    SELECT * INTO v_movement
    FROM inventory_movements
    WHERE order_id = NEW.id AND movement_type = 'reservation'
    LIMIT 1;

    IF FOUND THEN
      -- Reservation exists: upgrade to sale_committed AND do real stock decrement
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_movement.items_json) AS item
      LOOP
        v_size := v_item.item->>'size';
        v_qty := COALESCE((v_item.item->>'qty')::int, (v_item.item->>'quantity')::int, 0);
        IF v_size IS NULL OR v_size = '' OR v_qty = 0 THEN CONTINUE; END IF;

        -- Decrement stock_by_size (real stock reduction)
        SELECT stock_by_size, committed_by_size INTO v_current_stock, v_current_committed
        FROM product_catalog WHERE id = (v_item.item->>'product_id')::uuid FOR UPDATE;

        IF v_current_stock IS NOT NULL THEN
          v_current_stock := jsonb_set(
            COALESCE(v_current_stock, '{}'::jsonb), 
            ARRAY[v_size],
            to_jsonb(GREATEST(0, COALESCE((v_current_stock->>v_size)::int, 0) - v_qty))
          );
          -- Also remove from committed (reservation is being fulfilled)
          v_current_committed := COALESCE(v_current_committed, '{}'::jsonb);
          v_current_committed := jsonb_set(
            v_current_committed, 
            ARRAY[v_size],
            to_jsonb(GREATEST(0, COALESCE((v_current_committed->>v_size)::int, 0) - v_qty))
          );
          UPDATE product_catalog 
          SET stock_by_size = v_current_stock, committed_by_size = v_current_committed
          WHERE id = (v_item.item->>'product_id')::uuid;
        END IF;
      END LOOP;

      -- Upgrade movement type
      UPDATE inventory_movements SET movement_type = 'sale_committed' 
      WHERE id = v_movement.id;

      NEW.stock_decremented_at := now();
      RETURN NEW;
    END IF;

    -- No reservation exists: do full commit + stock decrement from order_items
    FOR v_item IN SELECT oi.product_id, oi.size, oi.quantity FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      v_size := v_item.size;
      v_qty := v_item.quantity;
      IF v_size IS NULL OR v_size = '' THEN CONTINUE; END IF;

      SELECT stock_by_size, committed_by_size INTO v_current_stock, v_current_committed
      FROM product_catalog WHERE id = v_item.product_id FOR UPDATE;

      IF FOUND THEN
        -- Decrement real stock
        v_current_stock := COALESCE(v_current_stock, '{}'::jsonb);
        v_current_stock := jsonb_set(v_current_stock, ARRAY[v_size],
          to_jsonb(GREATEST(0, COALESCE((v_current_stock->>v_size)::int, 0) - v_qty)));
        
        UPDATE product_catalog SET stock_by_size = v_current_stock WHERE id = v_item.product_id;

        v_items_array := v_items_array || jsonb_build_object(
          'product_id', v_item.product_id, 'size', v_size, 'qty', v_qty);
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2) Recreate revert_stock_on_cancel (already correct but ensure it exists cleanly)
CREATE OR REPLACE FUNCTION revert_stock_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement RECORD;
BEGIN
  -- Only on status change TO cancel/expire
  IF NEW.status NOT IN ('cancelado', 'expirado', 'pagamento_rejeitado') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- Find the reservation or sale_committed movement
  SELECT * INTO v_movement
  FROM inventory_movements
  WHERE order_id = NEW.id AND movement_type IN ('reservation', 'sale_committed')
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Revert committed_by_size for each item
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

  -- Mark movement as reverted
  UPDATE inventory_movements SET movement_type = 'reservation_reverted'
  WHERE id = v_movement.id;

  NEW.stock_decremented_at := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) CREATE THE MISSING TRIGGERS
CREATE TRIGGER trg_order_paid
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_paid();

CREATE TRIGGER trg_order_cancel_revert
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION revert_stock_on_cancel();
