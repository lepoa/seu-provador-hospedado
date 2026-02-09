
-- =====================================================
-- Migration: Fix Live Order Reservation & Attention Workflow
-- =====================================================

-- 1. BACKFILL: Set reserved_until for existing Live orders without it
UPDATE orders o
SET reserved_until = o.created_at + (
  COALESCE(
    (SELECT reservation_expiry_minutes FROM live_events le WHERE le.id = o.live_event_id),
    10080
  ) || ' minutes'
)::interval
WHERE o.source = 'live'
  AND o.status = 'aguardando_pagamento'
  AND o.reserved_until IS NULL
  AND o.live_event_id IS NOT NULL;

-- 2. Add attention_log table for tracking attention resolutions (if not exists)
CREATE TABLE IF NOT EXISTS public.live_attention_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_cart_id uuid NOT NULL REFERENCES live_carts(id) ON DELETE CASCADE,
  attention_type text NOT NULL CHECK (attention_type IN ('cancellation', 'item_removal', 'reallocation', 'quantity_reduction', 'expired_reservation')),
  product_id uuid REFERENCES product_catalog(id),
  product_name text,
  size text,
  quantity integer DEFAULT 1,
  origin_bag_number integer,
  destination_bag_number integer,
  destination_instagram text,
  payload jsonb DEFAULT '{}',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_attention_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for live_attention_log (drop if exist first)
DROP POLICY IF EXISTS "Merchants can view live_attention_log" ON public.live_attention_log;
DROP POLICY IF EXISTS "Merchants can insert live_attention_log" ON public.live_attention_log;
DROP POLICY IF EXISTS "Merchants can update live_attention_log" ON public.live_attention_log;

CREATE POLICY "Merchants can view live_attention_log"
  ON public.live_attention_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('merchant', 'admin')
    )
  );

CREATE POLICY "Merchants can insert live_attention_log"
  ON public.live_attention_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('merchant', 'admin')
    )
  );

CREATE POLICY "Merchants can update live_attention_log"
  ON public.live_attention_log
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('merchant', 'admin')
    )
  );

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_live_attention_log_cart_id 
  ON public.live_attention_log(live_cart_id);

CREATE INDEX IF NOT EXISTS idx_live_attention_log_unresolved 
  ON public.live_attention_log(live_cart_id) 
  WHERE resolved_at IS NULL;

-- 4. Drop old function and create new expire_order_reservations
DROP FUNCTION IF EXISTS public.expire_order_reservations();

CREATE OR REPLACE FUNCTION public.expire_order_reservations()
RETURNS TABLE(order_id uuid, old_status text, order_source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE orders
    SET 
      status = 'cancelado',
      cancel_reason = 'reservation_expired',
      canceled_at = now(),
      updated_at = now(),
      requires_physical_cancel = CASE WHEN source = 'live' THEN true ELSE false END,
      attention_reason = CASE WHEN source = 'live' THEN 'reserva_live_expirada' ELSE NULL END,
      attention_at = CASE WHEN source = 'live' THEN now() ELSE NULL END
    WHERE 
      status = 'aguardando_pagamento'
      AND reserved_until IS NOT NULL
      AND reserved_until < now()
    RETURNING orders.id, 'aguardando_pagamento'::text, orders.source::text
  )
  SELECT e.id, e.old_status, e.order_source FROM expired e;
END;
$$;

-- 5. Create function to check if cart is in committed state
CREATE OR REPLACE FUNCTION public.is_cart_in_committed_state(p_cart_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart record;
  v_has_separated_items boolean;
BEGIN
  SELECT 
    label_printed_at,
    separation_status,
    operational_status
  INTO v_cart
  FROM live_carts
  WHERE id = p_cart_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM live_cart_items
    WHERE live_cart_id = p_cart_id
    AND separation_status IN ('separado', 'retirado_confirmado')
  ) INTO v_has_separated_items;
  
  RETURN (
    v_cart.label_printed_at IS NOT NULL OR
    v_cart.separation_status = 'separado' OR
    v_has_separated_items
  );
END;
$$;

-- 6. Create function to log attention requirement
CREATE OR REPLACE FUNCTION public.log_live_attention(
  p_cart_id uuid,
  p_attention_type text,
  p_product_id uuid DEFAULT NULL,
  p_product_name text DEFAULT NULL,
  p_size text DEFAULT NULL,
  p_quantity integer DEFAULT 1,
  p_origin_bag_number integer DEFAULT NULL,
  p_destination_bag_number integer DEFAULT NULL,
  p_destination_instagram text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO live_attention_log (
    live_cart_id,
    attention_type,
    product_id,
    product_name,
    size,
    quantity,
    origin_bag_number,
    destination_bag_number,
    destination_instagram,
    payload
  ) VALUES (
    p_cart_id,
    p_attention_type,
    p_product_id,
    p_product_name,
    p_size,
    p_quantity,
    p_origin_bag_number,
    p_destination_bag_number,
    p_destination_instagram,
    p_payload
  )
  RETURNING id INTO v_log_id;
  
  UPDATE live_carts
  SET separation_status = 'atencao',
      needs_label_reprint = CASE 
        WHEN label_printed_at IS NOT NULL THEN true 
        ELSE needs_label_reprint 
      END
  WHERE id = p_cart_id;
  
  RETURN v_log_id;
END;
$$;

-- 7. Create function to resolve attention
CREATE OR REPLACE FUNCTION public.resolve_live_attention(
  p_log_id uuid,
  p_resolved_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id uuid;
  v_remaining_count integer;
BEGIN
  UPDATE live_attention_log
  SET resolved_at = now(),
      resolved_by = p_resolved_by
  WHERE id = p_log_id
  RETURNING live_cart_id INTO v_cart_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  SELECT COUNT(*) INTO v_remaining_count
  FROM live_attention_log
  WHERE live_cart_id = v_cart_id
    AND resolved_at IS NULL;
  
  IF v_remaining_count = 0 THEN
    UPDATE live_carts
    SET separation_status = CASE
      WHEN EXISTS(
        SELECT 1 FROM live_cart_items lci
        WHERE lci.live_cart_id = v_cart_id
          AND lci.status IN ('reservado', 'confirmado')
          AND lci.separation_status != 'separado'
      ) THEN 'em_separacao'
      ELSE 'separado'
    END
    WHERE id = v_cart_id;
  END IF;
  
  RETURN true;
END;
$$;

-- 8. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_cart_in_committed_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_live_attention(uuid, text, uuid, text, text, integer, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_live_attention(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_order_reservations() TO authenticated;
