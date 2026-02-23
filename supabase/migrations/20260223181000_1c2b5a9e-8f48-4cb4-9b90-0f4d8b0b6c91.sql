-- Hotfix: prevent paid->sold rollback caused by legacy guard trigger.
-- Symptom: pending order reserves correctly, but after changing to "pago"
-- reserved goes to 0 and sold stays 0 (stock becomes available again).

-- 1) Remove obsolete trigger/function that subtract sold on paid transition.
DROP TRIGGER IF EXISTS zzz_orders_catalog_paid_committed_guard ON public.orders;
DROP FUNCTION IF EXISTS public.normalize_catalog_paid_committed();

-- 2) Backfill paid catalog orders that are still not committed.
DO $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN
    SELECT o.id
    FROM public.orders o
    LEFT JOIN public.inventory_movements im ON im.order_id = o.id
    WHERE COALESCE(o.source, 'catalog') <> 'live'
      AND o.status = 'pago'
      AND (
        o.stock_decremented_at IS NULL
        OR im.id IS NULL
        OR im.movement_type = 'reservation'
      )
  LOOP
    PERFORM public.commit_order_stock(v_order.id);

    UPDATE public.orders
       SET stock_decremented_at = COALESCE(stock_decremented_at, now()),
           updated_at = now()
     WHERE id = v_order.id;
  END LOOP;
END;
$$;
