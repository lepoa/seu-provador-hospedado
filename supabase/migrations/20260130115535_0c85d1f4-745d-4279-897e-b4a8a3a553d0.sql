-- ============================================================
-- PARTE 1: Trigger de baixa de estoque ao virar "pago"
-- ============================================================

-- Adicionar coluna de controle para rastrear quando estoque foi decrementado
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_decremented_at timestamptz;

-- Criar função que decrementa estoque de forma idempotente
CREATE OR REPLACE FUNCTION public.decrement_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_current_stock JSONB;
  v_current_committed JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement_exists BOOLEAN;
  v_items_array JSONB := '[]'::jsonb;
BEGIN
  -- Skip if already processed
  IF NEW.stock_decremented_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if movement already exists (idempotency via inventory_movements)
  SELECT EXISTS(
    SELECT 1 FROM inventory_movements WHERE order_id = NEW.id
  ) INTO v_movement_exists;
  
  IF v_movement_exists THEN
    -- Just update the timestamp, stock was already decremented
    NEW.stock_decremented_at := now();
    RETURN NEW;
  END IF;
  
  -- Process each order item
  FOR v_item IN
    SELECT oi.product_id, oi.size, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    v_size := v_item.size;
    v_qty := v_item.quantity;
    
    -- Get current stock values
    SELECT stock_by_size, committed_by_size 
    INTO v_current_stock, v_current_committed
    FROM product_catalog 
    WHERE id = v_item.product_id
    FOR UPDATE; -- Lock the row
    
    IF v_current_stock IS NOT NULL THEN
      -- Decrement stock_by_size
      v_current_stock := jsonb_set(
        COALESCE(v_current_stock, '{}'::jsonb),
        ARRAY[v_size],
        to_jsonb(GREATEST(0, COALESCE((v_current_stock->>v_size)::int, 0) - v_qty))
      );
      
      -- Decrement committed_by_size (reserved stock is now sold)
      v_current_committed := jsonb_set(
        COALESCE(v_current_committed, '{}'::jsonb),
        ARRAY[v_size],
        to_jsonb(GREATEST(0, COALESCE((v_current_committed->>v_size)::int, 0) - v_qty))
      );
      
      -- Update product
      UPDATE product_catalog
      SET stock_by_size = v_current_stock,
          committed_by_size = v_current_committed
      WHERE id = v_item.product_id;
      
      -- Add to items array for audit
      v_items_array := v_items_array || jsonb_build_object(
        'product_id', v_item.product_id,
        'size', v_size,
        'qty', v_qty
      );
    END IF;
  END LOOP;
  
  -- Record the movement for idempotency
  INSERT INTO inventory_movements (order_id, movement_type, items_json)
  VALUES (NEW.id, 'sale_decrement', v_items_array)
  ON CONFLICT (order_id) DO NOTHING;
  
  -- Mark order as processed
  NEW.stock_decremented_at := now();
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires when status changes to 'pago'
DROP TRIGGER IF EXISTS trigger_decrement_stock_on_paid ON orders;
CREATE TRIGGER trigger_decrement_stock_on_paid
BEFORE UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago')
EXECUTE FUNCTION public.decrement_stock_on_paid();

-- ============================================================
-- PARTE 3: Campos para controle de WhatsApp
-- ============================================================

-- Adicionar campos para rastrear envio de WhatsApp por status
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_whatsapp_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_whatsapp_sent_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS whatsapp_message_override text;

-- ============================================================
-- OPTIONAL: Trigger para reverter estoque em cancelamento
-- ============================================================

CREATE OR REPLACE FUNCTION public.revert_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_current_stock JSONB;
  v_size TEXT;
  v_qty INT;
  v_movement RECORD;
BEGIN
  -- Only run if stock was decremented and order is being canceled
  IF OLD.stock_decremented_at IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the movement record
  SELECT * INTO v_movement
  FROM inventory_movements 
  WHERE order_id = NEW.id AND movement_type = 'sale_decrement';
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Restore stock for each item
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(v_movement.items_json) AS item
  LOOP
    v_size := v_item.item->>'size';
    v_qty := (v_item.item->>'qty')::int;
    
    -- Get current stock
    SELECT stock_by_size INTO v_current_stock
    FROM product_catalog 
    WHERE id = (v_item.item->>'product_id')::uuid
    FOR UPDATE;
    
    IF v_current_stock IS NOT NULL THEN
      -- Add stock back
      v_current_stock := jsonb_set(
        v_current_stock,
        ARRAY[v_size],
        to_jsonb(COALESCE((v_current_stock->>v_size)::int, 0) + v_qty)
      );
      
      UPDATE product_catalog
      SET stock_by_size = v_current_stock
      WHERE id = (v_item.item->>'product_id')::uuid;
    END IF;
  END LOOP;
  
  -- Mark movement as reverted
  UPDATE inventory_movements 
  SET movement_type = 'sale_reverted'
  WHERE order_id = NEW.id;
  
  -- Clear the timestamp
  NEW.stock_decremented_at := NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger for cancellation
DROP TRIGGER IF EXISTS trigger_revert_stock_on_cancel ON orders;
CREATE TRIGGER trigger_revert_stock_on_cancel
BEFORE UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status IN ('cancelado', 'reembolsado') AND OLD.status = 'pago')
EXECUTE FUNCTION public.revert_stock_on_cancel();