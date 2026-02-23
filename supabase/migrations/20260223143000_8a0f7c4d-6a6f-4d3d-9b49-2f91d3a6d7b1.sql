-- Guardrail for catalog paid flow:
-- Some environments can still end with committed_by_size > 0 after status = pago,
-- which makes available stock look zero even when physical stock was already decremented.
--
-- This trigger runs only for catalog orders on transition to paid and normalizes
-- committed_by_size by subtracting paid order quantities once more (idempotent via GREATEST 0).

CREATE OR REPLACE FUNCTION public.normalize_catalog_paid_committed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_committed JSONB;
  v_size_norm TEXT;
  v_key TEXT;
  v_qty INT;
  v_found_key BOOLEAN;
  v_has_order_items BOOLEAN := false;
BEGIN
  -- Only for transition to paid
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'pago' THEN
    RETURN NEW;
  END IF;

  -- Run on first transition to paid, or when stock marker is updated on an already-paid order.
  IF OLD.status = 'pago' AND NEW.stock_decremented_at IS NOT DISTINCT FROM OLD.stock_decremented_at THEN
    RETURN NEW;
  END IF;

  -- Never run for live orders.
  IF NEW.live_cart_id IS NOT NULL OR COALESCE(NEW.source, 'catalog') = 'live' THEN
    RETURN NEW;
  END IF;

  -- Primary source: order_items.
  FOR v_item IN
    SELECT oi.product_id, oi.size, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    v_has_order_items := true;
    v_size_norm := upper(btrim(v_item.size));
    v_qty := v_item.quantity;

    IF v_item.product_id IS NULL OR v_size_norm IS NULL OR v_size_norm = '' OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT committed_by_size
      INTO v_committed
      FROM public.product_catalog
     WHERE id = v_item.product_id
     FOR UPDATE;

    v_committed := COALESCE(v_committed, '{}'::jsonb);

    -- Decrement every key variant that matches this size when normalized.
    v_found_key := false;
    FOR v_key IN
      SELECT key_name
      FROM jsonb_object_keys(v_committed) AS t(key_name)
      WHERE upper(btrim(key_name)) = v_size_norm
    LOOP
      v_found_key := true;
      v_committed := jsonb_set(
        v_committed,
        ARRAY[v_key],
        to_jsonb(GREATEST(0, COALESCE((v_committed->>v_key)::int, 0) - v_qty)),
        false
      );
    END LOOP;

    -- If no variant key exists, still force canonical key to avoid leaks.
    IF NOT v_found_key THEN
      v_committed := jsonb_set(
        v_committed,
        ARRAY[v_size_norm],
        to_jsonb(GREATEST(0, COALESCE((v_committed->>v_size_norm)::int, 0) - v_qty)),
        true
      );
    END IF;

    UPDATE public.product_catalog
       SET committed_by_size = v_committed
     WHERE id = v_item.product_id;
  END LOOP;

  -- Fallback source: inventory movement payload (covers rare orders without order_items).
  IF NOT v_has_order_items THEN
    FOR v_item IN
      SELECT
        (ji->>'product_id')::uuid AS product_id,
        COALESCE(NULLIF(ji->>'size', ''), NULLIF(ji->>'tamanho', '')) AS size,
        COALESCE(
          CASE WHEN COALESCE(ji->>'qty', '') ~ '^[0-9]+$' THEN (ji->>'qty')::int ELSE NULL END,
          CASE WHEN COALESCE(ji->>'quantity', '') ~ '^[0-9]+$' THEN (ji->>'quantity')::int ELSE NULL END,
          CASE WHEN COALESCE(ji->>'qtd', '') ~ '^[0-9]+$' THEN (ji->>'qtd')::int ELSE NULL END,
          0
        ) AS quantity
      FROM public.inventory_movements im
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(im.items_json, '[]'::jsonb)) ji
      WHERE im.order_id = NEW.id
        AND im.movement_type IN ('sale_committed', 'reservation')
    LOOP
      v_size_norm := upper(btrim(v_item.size));
      v_qty := v_item.quantity;

      IF v_item.product_id IS NULL OR v_size_norm IS NULL OR v_size_norm = '' OR v_qty IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT committed_by_size
        INTO v_committed
        FROM public.product_catalog
       WHERE id = v_item.product_id
       FOR UPDATE;

      v_committed := COALESCE(v_committed, '{}'::jsonb);

      v_found_key := false;
      FOR v_key IN
        SELECT key_name
        FROM jsonb_object_keys(v_committed) AS t(key_name)
        WHERE upper(btrim(key_name)) = v_size_norm
      LOOP
        v_found_key := true;
        v_committed := jsonb_set(
          v_committed,
          ARRAY[v_key],
          to_jsonb(GREATEST(0, COALESCE((v_committed->>v_key)::int, 0) - v_qty)),
          false
        );
      END LOOP;

      IF NOT v_found_key THEN
        v_committed := jsonb_set(
          v_committed,
          ARRAY[v_size_norm],
          to_jsonb(GREATEST(0, COALESCE((v_committed->>v_size_norm)::int, 0) - v_qty)),
          true
        );
      END IF;

      UPDATE public.product_catalog
         SET committed_by_size = v_committed
       WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_orders_catalog_paid_committed_guard ON public.orders;
CREATE TRIGGER zzz_orders_catalog_paid_committed_guard
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_catalog_paid_committed();
