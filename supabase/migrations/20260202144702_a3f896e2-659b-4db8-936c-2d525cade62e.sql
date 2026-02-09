-- Add promotion tracking columns to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotional_tables(id),
ADD COLUMN IF NOT EXISTS promotion_name TEXT,
ADD COLUMN IF NOT EXISTS discount_source TEXT;

-- Add comment for documentation
COMMENT ON COLUMN order_items.promotion_id IS 'ID of the promotional table applied at time of order';
COMMENT ON COLUMN order_items.promotion_name IS 'Name of the promotion for historical reference';
COMMENT ON COLUMN order_items.discount_source IS 'Source of discount: promotional_table_product, promotional_table_category, promotional_table_store, or product_native';

-- Create function to recalculate order prices from backend (before payment)
CREATE OR REPLACE FUNCTION finalize_order_prices(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_item RECORD;
  v_price_data RECORD;
  v_new_subtotal NUMERIC := 0;
  v_order RECORD;
  v_result JSONB := '[]'::JSONB;
BEGIN
  -- Get order info
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Process each order item
  FOR v_item IN 
    SELECT oi.*, pc.price AS catalog_price, pc.category
    FROM order_items oi
    JOIN product_catalog pc ON pc.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    -- Get effective price from the RPC
    SELECT * INTO v_price_data
    FROM get_products_effective_prices('catalog', ARRAY[v_item.product_id])
    LIMIT 1;
    
    IF FOUND THEN
      -- Update order item with backend-calculated prices
      UPDATE order_items SET
        unit_price_original = v_price_data.original_price,
        product_price = v_price_data.effective_price,
        discount_percent = CASE 
          WHEN v_price_data.original_price > 0 AND v_price_data.effective_price < v_price_data.original_price 
          THEN ROUND(((v_price_data.original_price - v_price_data.effective_price) / v_price_data.original_price) * 100, 2)
          ELSE 0
        END,
        subtotal = v_price_data.effective_price * v_item.quantity,
        promotion_id = v_price_data.promotion_id,
        promotion_name = v_price_data.promotion_name,
        discount_source = v_price_data.discount_source
      WHERE id = v_item.id;
      
      v_new_subtotal := v_new_subtotal + (v_price_data.effective_price * v_item.quantity);
      
      v_result := v_result || jsonb_build_object(
        'product_id', v_item.product_id,
        'original_price', v_price_data.original_price,
        'effective_price', v_price_data.effective_price,
        'promotion_name', v_price_data.promotion_name
      );
    ELSE
      -- No price data found, use catalog price
      v_new_subtotal := v_new_subtotal + (v_item.catalog_price * v_item.quantity);
    END IF;
  END LOOP;
  
  -- Update order totals
  UPDATE orders SET
    subtotal = v_new_subtotal,
    total = v_new_subtotal - COALESCE(coupon_discount, 0) + COALESCE(shipping_fee, 0)
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'new_subtotal', v_new_subtotal,
    'items_updated', jsonb_array_length(v_result),
    'details', v_result
  );
END;
$$;