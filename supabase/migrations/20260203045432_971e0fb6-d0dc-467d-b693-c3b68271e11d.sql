-- Add source, live_cart_id, and live_bag_number to orders table
-- for unified catalog + live order management

-- Add source column with enum-style constraint
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'catalog';

-- Add constraint to validate source values
ALTER TABLE public.orders
ADD CONSTRAINT orders_source_check CHECK (source IN ('catalog', 'live'));

-- Add live_cart_id for linking back to original live cart
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS live_cart_id uuid REFERENCES public.live_carts(id);

-- Add live_bag_number for display purposes
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS live_bag_number integer;

-- Create index for efficient filtering by source
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);

-- Create index for live_cart_id lookups
CREATE INDEX IF NOT EXISTS idx_orders_live_cart_id ON public.orders(live_cart_id);

-- Create unique constraint on live_cart_id to ensure one order per live cart (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_live_cart_id_unique 
ON public.orders(live_cart_id) WHERE live_cart_id IS NOT NULL;

-- Create function to sync live cart to orders table
CREATE OR REPLACE FUNCTION public.sync_live_cart_to_orders(p_live_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cart RECORD;
  v_customer RECORD;
  v_event RECORD;
  v_existing_order_id uuid;
  v_order_id uuid;
  v_items_json jsonb;
  v_address_snapshot jsonb;
  v_customer_name text;
  v_customer_phone text;
  v_full_address text;
BEGIN
  -- Get live cart with items
  SELECT 
    lc.*,
    le.titulo as live_title,
    lcust.instagram_handle,
    lcust.nome as customer_nome,
    lcust.whatsapp as customer_whatsapp,
    lcust.client_id
  INTO v_cart
  FROM live_carts lc
  JOIN live_events le ON le.id = lc.live_event_id
  JOIN live_customers lcust ON lcust.id = lc.live_customer_id
  WHERE lc.id = p_live_cart_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Live cart not found');
  END IF;

  -- Check if order already exists for this live cart (upsert logic)
  SELECT id INTO v_existing_order_id FROM orders WHERE live_cart_id = p_live_cart_id;

  -- Get customer info from linked client if available
  IF v_cart.client_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM customers WHERE id = v_cart.client_id;
    v_customer_name := COALESCE(v_customer.name, v_cart.customer_nome, v_cart.instagram_handle);
    v_customer_phone := COALESCE(v_customer.phone, v_cart.customer_whatsapp, '');
  ELSE
    v_customer_name := COALESCE(v_cart.customer_nome, v_cart.instagram_handle);
    v_customer_phone := COALESCE(v_cart.customer_whatsapp, '');
  END IF;

  -- Build address from snapshot
  v_address_snapshot := COALESCE(v_cart.shipping_address_snapshot, '{}'::jsonb);
  v_full_address := COALESCE(
    v_address_snapshot->>'street', 
    v_address_snapshot->>'address_line',
    ''
  );
  IF v_address_snapshot->>'number' IS NOT NULL THEN
    v_full_address := v_full_address || ', ' || (v_address_snapshot->>'number');
  END IF;
  IF v_address_snapshot->>'neighborhood' IS NOT NULL THEN
    v_full_address := v_full_address || ' - ' || (v_address_snapshot->>'neighborhood');
  END IF;
  IF v_address_snapshot->>'city' IS NOT NULL THEN
    v_full_address := v_full_address || ', ' || (v_address_snapshot->>'city');
  END IF;
  IF v_address_snapshot->>'state' IS NOT NULL THEN
    v_full_address := v_full_address || ' - ' || (v_address_snapshot->>'state');
  END IF;

  -- Map live cart status to order status
  -- Status mapping: aguardando_pagamento -> aguardando_pagamento, pago -> pago, etc.

  IF v_existing_order_id IS NOT NULL THEN
    -- UPDATE existing order
    UPDATE orders SET
      status = CASE v_cart.status
        WHEN 'pago' THEN 
          CASE v_cart.operational_status
            WHEN 'entregue' THEN 'entregue'
            WHEN 'retirado' THEN 'entregue'
            WHEN 'postado' THEN 'enviado'
            WHEN 'em_rota' THEN 'enviado'
            WHEN 'etiqueta_gerada' THEN 'etiqueta_gerada'
            ELSE 'pago'
          END
        WHEN 'cancelado' THEN 'cancelado'
        WHEN 'expirado' THEN 'cancelado'
        ELSE 'aguardando_pagamento'
      END,
      customer_name = v_customer_name,
      customer_phone = v_customer_phone,
      customer_address = v_full_address,
      subtotal = v_cart.subtotal,
      total = v_cart.total,
      shipping_fee = v_cart.frete,
      delivery_method = v_cart.delivery_method,
      delivery_period = v_cart.delivery_period,
      delivery_notes = v_cart.delivery_notes,
      address_snapshot = v_address_snapshot,
      tracking_code = v_cart.shipping_tracking_code,
      me_shipment_id = v_cart.me_shipment_id,
      me_label_url = v_cart.me_label_url,
      coupon_id = v_cart.coupon_id,
      coupon_discount = v_cart.coupon_discount,
      seller_id = v_cart.seller_id,
      paid_at = v_cart.paid_at,
      live_bag_number = v_cart.bag_number,
      updated_at = now()
    WHERE id = v_existing_order_id;

    v_order_id := v_existing_order_id;
  ELSE
    -- INSERT new order
    INSERT INTO orders (
      source,
      live_cart_id,
      live_event_id,
      live_bag_number,
      customer_name,
      customer_phone,
      customer_address,
      subtotal,
      total,
      shipping_fee,
      delivery_method,
      delivery_period,
      delivery_notes,
      address_snapshot,
      tracking_code,
      me_shipment_id,
      me_label_url,
      coupon_id,
      coupon_discount,
      seller_id,
      paid_at,
      status,
      payment_status
    ) VALUES (
      'live',
      p_live_cart_id,
      v_cart.live_event_id,
      v_cart.bag_number,
      v_customer_name,
      v_customer_phone,
      v_full_address,
      v_cart.subtotal,
      v_cart.total,
      v_cart.frete,
      v_cart.delivery_method,
      v_cart.delivery_period,
      v_cart.delivery_notes,
      v_address_snapshot,
      v_cart.shipping_tracking_code,
      v_cart.me_shipment_id,
      v_cart.me_label_url,
      v_cart.coupon_id,
      v_cart.coupon_discount,
      v_cart.seller_id,
      v_cart.paid_at,
      CASE v_cart.status
        WHEN 'pago' THEN 'pago'
        WHEN 'cancelado' THEN 'cancelado'
        WHEN 'expirado' THEN 'cancelado'
        ELSE 'aguardando_pagamento'
      END,
      CASE v_cart.status
        WHEN 'pago' THEN 'approved'
        ELSE 'pending'
      END
    )
    RETURNING id INTO v_order_id;

    -- Insert order items from live cart items
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      product_price,
      quantity,
      size,
      color,
      image_url,
      product_sku
    )
    SELECT 
      v_order_id,
      lci.product_id,
      COALESCE(pc.name, 'Produto'),
      lci.preco_unitario,
      lci.qtd,
      COALESCE(lci.variante->>'tamanho', ''),
      pc.color,
      pc.image_url,
      pc.sku
    FROM live_cart_items lci
    LEFT JOIN product_catalog pc ON pc.id = lci.product_id
    WHERE lci.live_cart_id = p_live_cart_id
    AND lci.status NOT IN ('cancelado', 'removido');
  END IF;

  -- Update live_carts with order_id reference
  UPDATE live_carts SET order_id = v_order_id WHERE id = p_live_cart_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'is_update', v_existing_order_id IS NOT NULL
  );
END;
$$;

-- Create trigger to auto-sync live cart to orders on status changes
CREATE OR REPLACE FUNCTION public.trigger_sync_live_cart_to_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync for meaningful status changes that should create/update an order
  -- Skip very early states before any commitment
  IF NEW.status IN ('aguardando_pagamento', 'cobrado', 'pago', 'cancelado', 'expirado') 
     OR (NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago')
     OR (NEW.operational_status IS DISTINCT FROM OLD.operational_status AND NEW.status = 'pago') THEN
    PERFORM sync_live_cart_to_orders(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on live_carts
DROP TRIGGER IF EXISTS on_live_cart_sync_to_orders ON public.live_carts;
CREATE TRIGGER on_live_cart_sync_to_orders
  AFTER UPDATE ON public.live_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_live_cart_to_orders();

-- Create function to sync order changes BACK to live_cart (for tracking, labels)
CREATE OR REPLACE FUNCTION public.sync_order_to_live_cart(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Get order with live cart reference
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND live_cart_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not a live order');
  END IF;

  -- Sync tracking info and operational status back to live_cart
  UPDATE live_carts SET
    shipping_tracking_code = COALESCE(v_order.tracking_code, shipping_tracking_code),
    me_shipment_id = COALESCE(v_order.me_shipment_id, me_shipment_id),
    me_label_url = COALESCE(v_order.me_label_url, me_label_url),
    operational_status = CASE v_order.status
      WHEN 'etiqueta_gerada' THEN 'etiqueta_gerada'
      WHEN 'enviado' THEN 'postado'
      WHEN 'entregue' THEN 'entregue'
      WHEN 'cancelado' THEN 'cancelado'
      ELSE operational_status
    END,
    updated_at = now()
  WHERE id = v_order.live_cart_id;

  RETURN jsonb_build_object('success', true, 'live_cart_id', v_order.live_cart_id);
END;
$$;

-- Create trigger to sync order updates to live_cart
CREATE OR REPLACE FUNCTION public.trigger_sync_order_to_live_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync if this is a live order and relevant fields changed
  IF NEW.live_cart_id IS NOT NULL AND (
    NEW.tracking_code IS DISTINCT FROM OLD.tracking_code OR
    NEW.me_shipment_id IS DISTINCT FROM OLD.me_shipment_id OR
    NEW.me_label_url IS DISTINCT FROM OLD.me_label_url OR
    NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    PERFORM sync_order_to_live_cart(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_sync_to_live_cart ON public.orders;
CREATE TRIGGER on_order_sync_to_live_cart
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_order_to_live_cart();