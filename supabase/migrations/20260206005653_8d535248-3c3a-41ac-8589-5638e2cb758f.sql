
-- =====================================================
-- FIX CRITICAL BUG: Duplicate live_cart_items causing double stock reservation
-- =====================================================

-- STEP 1: Clean up any existing duplicates by consolidating qtd
-- Using text cast for uuid to allow MIN function
DO $$
DECLARE
  v_dup RECORD;
  v_keep_id uuid;
  v_total_qtd integer;
BEGIN
  FOR v_dup IN
    SELECT 
      live_cart_id,
      product_id,
      variante->>'tamanho' as tamanho,
      array_agg(id ORDER BY created_at ASC) as item_ids,
      SUM(qtd)::integer as total_qtd
    FROM live_cart_items
    GROUP BY live_cart_id, product_id, variante->>'tamanho'
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first (oldest) item
    v_keep_id := v_dup.item_ids[1];
    v_total_qtd := v_dup.total_qtd;
    
    -- Update the kept record with total quantity
    UPDATE live_cart_items 
    SET qtd = v_total_qtd 
    WHERE id = v_keep_id;
    
    -- Delete all other duplicates
    DELETE FROM live_cart_items 
    WHERE id = ANY(v_dup.item_ids[2:]);
    
    RAISE NOTICE 'Consolidated duplicates for cart %, product %, size %: kept %, deleted %, total qtd %', 
      v_dup.live_cart_id, v_dup.product_id, v_dup.tamanho, 
      v_keep_id, array_length(v_dup.item_ids, 1) - 1, v_total_qtd;
  END LOOP;
END;
$$;

-- STEP 2: Add generated column for tamanho to enable unique constraint
ALTER TABLE live_cart_items 
ADD COLUMN IF NOT EXISTS tamanho text GENERATED ALWAYS AS ((variante->>'tamanho')) STORED;

-- STEP 3: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_cart_items_unique_product_size 
ON live_cart_items (live_cart_id, product_id, tamanho);

-- STEP 4: Create idempotent upsert function for adding items to cart
CREATE OR REPLACE FUNCTION upsert_live_cart_item(
  p_live_cart_id uuid,
  p_product_id uuid,
  p_variante jsonb,
  p_qtd integer,
  p_preco_unitario numeric,
  p_expiracao_reserva_em timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_qtd integer;
  v_new_qtd integer;
  v_tamanho text;
  v_result_id uuid;
  v_action text;
BEGIN
  -- Extract tamanho from variante
  v_tamanho := p_variante->>'tamanho';
  
  -- Acquire advisory lock to serialize access for this specific item
  -- This prevents race conditions when multiple requests try to add the same item
  PERFORM pg_advisory_xact_lock(
    hashtext('live_cart_item_' || p_live_cart_id::text || '_' || p_product_id::text || '_' || COALESCE(v_tamanho, 'null'))
  );
  
  -- Check if item already exists in this cart
  SELECT id, qtd INTO v_existing_id, v_existing_qtd
  FROM live_cart_items
  WHERE live_cart_id = p_live_cart_id
    AND product_id = p_product_id
    AND (variante->>'tamanho') = v_tamanho
  FOR UPDATE;
  
  IF v_existing_id IS NOT NULL THEN
    -- Item exists: UPDATE by adding quantity
    v_new_qtd := v_existing_qtd + p_qtd;
    
    UPDATE live_cart_items
    SET 
      qtd = v_new_qtd,
      -- Only update expiration if provided
      expiracao_reserva_em = COALESCE(p_expiracao_reserva_em, expiracao_reserva_em),
      updated_at = now()
    WHERE id = v_existing_id;
    
    v_result_id := v_existing_id;
    v_action := 'updated';
  ELSE
    -- Item does not exist: INSERT new record
    INSERT INTO live_cart_items (
      live_cart_id,
      product_id,
      variante,
      qtd,
      preco_unitario,
      status,
      reservado_em,
      expiracao_reserva_em
    )
    VALUES (
      p_live_cart_id,
      p_product_id,
      p_variante,
      p_qtd,
      p_preco_unitario,
      'reservado',
      now(),
      p_expiracao_reserva_em
    )
    RETURNING id INTO v_result_id;
    
    v_new_qtd := p_qtd;
    v_action := 'inserted';
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'item_id', v_result_id,
    'qtd', v_new_qtd,
    'previous_qtd', COALESCE(v_existing_qtd, 0)
  );
EXCEPTION WHEN unique_violation THEN
  -- Handle race condition: if we hit unique constraint, retry recursively
  RETURN upsert_live_cart_item(p_live_cart_id, p_product_id, p_variante, p_qtd, p_preco_unitario, p_expiracao_reserva_em);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_live_cart_item TO authenticated;

-- STEP 5: Create guard function for any future stock-related triggers on live_cart_items
CREATE OR REPLACE FUNCTION guard_live_cart_item_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- GUARD 1: Skip if we're in a nested trigger (prevents double execution)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  
  -- GUARD 2: For updates, only proceed if qtd actually changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.qtd = NEW.qtd AND OLD.status = NEW.status THEN
      RETURN NEW; -- No meaningful change, skip
    END IF;
  END IF;
  
  -- Continue with normal execution
  RETURN NEW;
END;
$$;

-- STEP 6: Ensure ensure_order_items_for_live_order uses correct columns
CREATE OR REPLACE FUNCTION ensure_order_items_for_live_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live_cart_id uuid;
  v_items_created integer := 0;
  v_item RECORD;
BEGIN
  -- Get live_cart_id from order
  SELECT live_cart_id INTO v_live_cart_id
  FROM orders
  WHERE id = p_order_id;
  
  IF v_live_cart_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if order items already exist
  IF EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id) THEN
    RETURN true;
  END IF;
  
  -- Copy items from live_cart_items to order_items using correct column names
  FOR v_item IN
    SELECT 
      lci.product_id,
      lci.variante->>'tamanho' as size,
      lci.variante->>'cor' as color,
      lci.qtd as quantity,
      lci.preco_unitario as price,
      p.name as product_name,
      p.sku as product_sku,
      (p.images->0->>'url')::text as image_url
    FROM live_cart_items lci
    JOIN product_catalog p ON p.id = lci.product_id
    WHERE lci.live_cart_id = v_live_cart_id
      AND lci.status IN ('reservado', 'confirmado')
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      product_sku,
      product_price,
      size,
      color,
      quantity,
      image_url
    )
    VALUES (
      p_order_id,
      v_item.product_id,
      COALESCE(v_item.product_name, 'Produto'),
      v_item.product_sku,
      v_item.price,
      v_item.size,
      v_item.color,
      v_item.quantity,
      v_item.image_url
    )
    ON CONFLICT DO NOTHING;
    
    v_items_created := v_items_created + 1;
  END LOOP;
  
  RETURN v_items_created > 0;
END;
$$;

-- STEP 7: Update product_available_stock view to ensure correct reserved calculation
DROP VIEW IF EXISTS public_product_stock CASCADE;
DROP VIEW IF EXISTS product_available_stock CASCADE;

CREATE OR REPLACE VIEW product_available_stock 
WITH (security_invoker = on)
AS
WITH stock_data AS (
  SELECT 
    p.id as product_id,
    kv.key as size,
    COALESCE((kv.value)::int, 0) as stock,
    COALESCE((p.committed_by_size->>kv.key)::int, 0) as committed
  FROM product_catalog p
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.stock_by_size, '{}'::jsonb)) kv
  WHERE p.is_active = true
),
live_reserved AS (
  -- Calculate reserved stock from active live carts
  -- CRITICAL: Using correct columns variante->>'tamanho' and qtd
  SELECT 
    lci.product_id,
    lci.variante->>'tamanho' as size,
    SUM(lci.qtd)::int as reserved
  FROM live_cart_items lci
  JOIN live_carts lc ON lc.id = lci.live_cart_id
  WHERE lci.status IN ('reservado', 'confirmado')
    AND lc.status NOT IN ('cancelado', 'expirado', 'pago')
    AND lc.stock_decremented_at IS NULL
  GROUP BY lci.product_id, lci.variante->>'tamanho'
)
SELECT 
  sd.product_id,
  sd.size,
  sd.stock,
  sd.committed,
  COALESCE(lr.reserved, 0) as reserved,
  GREATEST(0, sd.stock - sd.committed - COALESCE(lr.reserved, 0)) as available
FROM stock_data sd
LEFT JOIN live_reserved lr 
  ON lr.product_id = sd.product_id AND lr.size = sd.size;

-- Recreate public_product_stock view
CREATE OR REPLACE VIEW public_product_stock
WITH (security_invoker = on)
AS
SELECT 
  product_id,
  size,
  available
FROM product_available_stock;

-- Grant necessary permissions
GRANT SELECT ON product_available_stock TO authenticated;
GRANT SELECT ON public_product_stock TO anon, authenticated;

-- STEP 8: Add comments explaining the fix
COMMENT ON INDEX idx_live_cart_items_unique_product_size IS 
'Unique constraint to prevent duplicate items in live cart. If same product+size is added multiple times, the upsert_live_cart_item function should increment qtd instead of creating duplicates.';

COMMENT ON FUNCTION upsert_live_cart_item IS 
'Idempotent function to add items to live cart. If item already exists (same product_id + tamanho), increments qtd. Uses advisory lock to prevent race conditions.';

COMMENT ON COLUMN live_cart_items.tamanho IS 
'Generated column from variante->>tamanho for unique constraint enforcement.';
