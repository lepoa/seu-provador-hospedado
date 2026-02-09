-- Fix the apply_live_cart_paid_effects function to not use updated_at column
-- (product_catalog doesn't have this column)

CREATE OR REPLACE FUNCTION public.apply_live_cart_paid_effects(p_live_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cart RECORD;
  v_item RECORD;
  v_product RECORD;
  v_erpStock JSONB;
  v_committed JSONB;
  v_newCommitted JSONB;
  v_newDisplayStock JSONB;
  v_size TEXT;
  v_items_decremented JSONB := '[]'::jsonb;
  v_movement_exists BOOLEAN;
BEGIN
  -- Lock the cart row to prevent race conditions
  SELECT * INTO v_cart FROM live_carts WHERE id = p_live_cart_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Live cart not found');
  END IF;

  -- Check if already processed (idempotent)
  IF v_cart.stock_decremented_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_processed', true,
      'live_cart_id', p_live_cart_id,
      'message', 'Stock already decremented at ' || v_cart.stock_decremented_at::text
    );
  END IF;

  -- Check if movement already exists (double idempotency check)
  SELECT EXISTS(
    SELECT 1 FROM inventory_movements 
    WHERE order_id = p_live_cart_id 
    AND movement_type = 'live_sale_decrement'
  ) INTO v_movement_exists;

  IF v_movement_exists THEN
    -- Fix the missing flag
    UPDATE live_carts SET stock_decremented_at = now() WHERE id = p_live_cart_id;
    RETURN jsonb_build_object(
      'success', true, 
      'already_processed', true,
      'reason', 'Movement already exists',
      'live_cart_id', p_live_cart_id
    );
  END IF;

  -- Process each confirmed item
  FOR v_item IN
    SELECT 
      lci.product_id,
      (lci.variante->>'tamanho')::text as size,
      lci.qtd as quantity
    FROM live_cart_items lci
    WHERE lci.live_cart_id = p_live_cart_id
    AND lci.status = 'confirmado'
  LOOP
    v_size := v_item.size;
    IF v_size IS NULL OR v_size = '' THEN
      CONTINUE;
    END IF;

    -- Lock and get product stock
    SELECT 
      erp_stock_by_size, 
      committed_by_size, 
      stock_by_size
    INTO v_product
    FROM product_catalog
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Calculate new committed (add to existing)
    v_erpStock := COALESCE(v_product.erp_stock_by_size, v_product.stock_by_size, '{}'::jsonb);
    v_committed := COALESCE(v_product.committed_by_size, '{}'::jsonb);
    
    v_newCommitted := v_committed || jsonb_build_object(
      v_size, COALESCE((v_committed->>v_size)::int, 0) + v_item.quantity
    );

    -- Recalculate display stock = erp - committed
    v_newDisplayStock := '{}'::jsonb;
    FOR v_size IN SELECT jsonb_object_keys(v_erpStock)
    LOOP
      v_newDisplayStock := v_newDisplayStock || jsonb_build_object(
        v_size, 
        GREATEST(0, COALESCE((v_erpStock->>v_size)::int, 0) - COALESCE((v_newCommitted->>v_size)::int, 0))
      );
    END LOOP;

    -- Update product stock (without updated_at since column doesn't exist)
    UPDATE product_catalog
    SET 
      committed_by_size = v_newCommitted,
      stock_by_size = v_newDisplayStock
    WHERE id = v_item.product_id;

    -- Track decremented items
    v_items_decremented := v_items_decremented || jsonb_build_object(
      'product_id', v_item.product_id,
      'size', v_item.size,
      'quantity', v_item.quantity
    );
  END LOOP;

  -- Record movement for audit and idempotency
  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (p_live_cart_id, 'live_sale_decrement', v_items_decremented);

  -- Mark cart as processed
  UPDATE live_carts 
  SET stock_decremented_at = now() 
  WHERE id = p_live_cart_id;

  -- Log the action
  INSERT INTO live_cart_status_history (live_cart_id, old_status, new_status, notes)
  VALUES (p_live_cart_id, 'pago', 'pago', 'Estoque baixado: ' || jsonb_array_length(v_items_decremented)::text || ' itens');

  RETURN jsonb_build_object(
    'success', true,
    'live_cart_id', p_live_cart_id,
    'stock_decremented', true,
    'items_count', jsonb_array_length(v_items_decremented),
    'items', v_items_decremented
  );
END;
$function$;

-- Create trigger to automatically apply stock effects when live cart becomes 'pago'
CREATE OR REPLACE FUNCTION public.trigger_apply_live_cart_paid_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when status changes TO 'pago'
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    PERFORM apply_live_cart_paid_effects(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_live_cart_paid ON public.live_carts;

-- Create the trigger
CREATE TRIGGER on_live_cart_paid
  AFTER UPDATE ON public.live_carts
  FOR EACH ROW
  WHEN (NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago')
  EXECUTE FUNCTION public.trigger_apply_live_cart_paid_effects();