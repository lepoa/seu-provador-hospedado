-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
  current_stock JSONB;
  current_qty INTEGER;
BEGIN
  -- Only trigger when status changes TO 'cancelado'
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    -- Loop through all items in the cancelled order
    FOR item IN 
      SELECT product_id, size, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id
    LOOP
      -- Get current stock for the product
      SELECT stock_by_size INTO current_stock
      FROM public.product_catalog
      WHERE id = item.product_id;
      
      -- Calculate new quantity (current + returned)
      current_qty := COALESCE((current_stock ->> item.size)::INTEGER, 0);
      
      -- Update stock_by_size with restored quantity
      UPDATE public.product_catalog
      SET stock_by_size = COALESCE(stock_by_size, '{}'::jsonb) || 
        jsonb_build_object(item.size, current_qty + item.quantity)
      WHERE id = item.product_id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for order cancellation
DROP TRIGGER IF EXISTS trigger_restore_stock_on_cancel ON public.orders;
CREATE TRIGGER trigger_restore_stock_on_cancel
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_cancel();