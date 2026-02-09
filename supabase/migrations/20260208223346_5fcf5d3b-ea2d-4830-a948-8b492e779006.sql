
-- 1) Create instagram_identities table for persistent @instagram recognition
CREATE TABLE IF NOT EXISTS public.instagram_identities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_handle_normalized TEXT NOT NULL UNIQUE,
  instagram_handle_raw TEXT NOT NULL,
  phone TEXT,
  customer_id UUID REFERENCES public.customers(id),
  last_order_id UUID REFERENCES public.orders(id),
  last_paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_instagram_identities_phone ON public.instagram_identities(phone);

-- RLS: admin full access, anon can read own handle via RPC
ALTER TABLE public.instagram_identities ENABLE ROW LEVEL SECURITY;

-- Admin/service role can do everything (via edge functions with service_role)
-- No direct client access needed - all via RPCs

-- 2) Create RPC: get_live_checkout - validates token and returns cart data (for guest checkout)
CREATE OR REPLACE FUNCTION public.get_live_checkout(p_cart_id UUID, p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart RECORD;
  v_items JSONB;
  v_customer RECORD;
  v_identity RECORD;
  v_result JSONB;
BEGIN
  -- Validate cart + token
  SELECT lc.*, le.titulo as event_title
  INTO v_cart
  FROM live_carts lc
  JOIN live_events le ON le.id = lc.live_event_id
  WHERE lc.id = p_cart_id AND lc.public_token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sacola não encontrada ou token inválido');
  END IF;
  
  IF v_cart.status = 'cancelado' THEN
    RETURN jsonb_build_object('error', 'Esta sacola foi cancelada');
  END IF;
  
  -- Get customer info
  SELECT * INTO v_customer FROM live_customers WHERE id = v_cart.live_customer_id;
  
  -- Get items
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', lci.id,
    'product_name', COALESCE(pc.name, 'Produto'),
    'product_image', pc.image_url,
    'color', (lci.variante->>'cor'),
    'size', (lci.variante->>'tamanho'),
    'quantity', lci.qtd,
    'unit_price', lci.preco_unitario,
    'status', lci.status
  )), '[]'::jsonb)
  INTO v_items
  FROM live_cart_items lci
  LEFT JOIN product_catalog pc ON pc.id = lci.product_id
  WHERE lci.live_cart_id = p_cart_id
    AND lci.status IN ('reservado', 'confirmado', 'expirado');
  
  -- Check instagram identity for auto-fill
  IF v_customer.instagram_handle IS NOT NULL THEN
    SELECT * INTO v_identity
    FROM instagram_identities
    WHERE instagram_handle_normalized = lower(trim(replace(v_customer.instagram_handle, '@', '')));
  END IF;
  
  v_result := jsonb_build_object(
    'id', v_cart.id,
    'status', v_cart.status,
    'bag_number', v_cart.bag_number,
    'subtotal', v_cart.subtotal,
    'frete', v_cart.frete,
    'total', v_cart.total,
    'coupon_discount', COALESCE(v_cart.coupon_discount, 0),
    'delivery_method', v_cart.delivery_method,
    'shipping_address_snapshot', v_cart.shipping_address_snapshot,
    'mp_checkout_url', v_cart.mp_checkout_url,
    'event_title', v_cart.event_title,
    'created_at', v_cart.created_at,
    'instagram_handle', v_customer.instagram_handle,
    'customer_name', v_customer.nome,
    'customer_whatsapp', v_customer.whatsapp,
    'items', v_items,
    'known_phone', v_identity.phone,
    'known_customer_id', v_identity.customer_id
  );
  
  RETURN v_result;
END;
$$;

-- 3) Create RPC: save_live_checkout_details - saves guest data before payment
CREATE OR REPLACE FUNCTION public.save_live_checkout_details(
  p_cart_id UUID,
  p_token UUID,
  p_name TEXT,
  p_phone TEXT,
  p_delivery_method TEXT,
  p_delivery_period TEXT DEFAULT NULL,
  p_delivery_notes TEXT DEFAULT NULL,
  p_address_snapshot JSONB DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_shipping_service_name TEXT DEFAULT NULL,
  p_shipping_deadline_days INTEGER DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart RECORD;
  v_total NUMERIC;
BEGIN
  -- Validate cart + token
  SELECT * INTO v_cart
  FROM live_carts
  WHERE id = p_cart_id AND public_token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sacola não encontrada ou token inválido');
  END IF;
  
  IF v_cart.status IN ('pago', 'cancelado') THEN
    RETURN jsonb_build_object('error', 'Esta sacola não pode mais ser alterada');
  END IF;
  
  -- Calculate total
  v_total := v_cart.subtotal + COALESCE(p_shipping_fee, 0);
  
  -- Update cart
  UPDATE live_carts SET
    delivery_method = p_delivery_method,
    delivery_period = p_delivery_period,
    delivery_notes = p_delivery_notes,
    shipping_address_snapshot = p_address_snapshot,
    frete = COALESCE(p_shipping_fee, 0),
    total = v_total,
    shipping_service_name = p_shipping_service_name,
    shipping_deadline_days = p_shipping_deadline_days,
    customer_checkout_notes = p_customer_notes,
    status = 'aguardando_pagamento',
    updated_at = now()
  WHERE id = p_cart_id;
  
  -- Update live_customer with name and phone
  UPDATE live_customers SET
    nome = COALESCE(NULLIF(p_name, ''), nome),
    whatsapp = COALESCE(NULLIF(p_phone, ''), whatsapp),
    updated_at = now()
  WHERE id = v_cart.live_customer_id;
  
  RETURN jsonb_build_object('success', true, 'total', v_total);
END;
$$;

-- 4) Create RPC: upsert_instagram_identity - called after payment
CREATE OR REPLACE FUNCTION public.upsert_instagram_identity(
  p_handle TEXT,
  p_phone TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := lower(trim(replace(p_handle, '@', '')));
  IF v_normalized = '' THEN RETURN; END IF;
  
  INSERT INTO instagram_identities (
    instagram_handle_normalized,
    instagram_handle_raw,
    phone,
    customer_id,
    last_order_id,
    last_paid_at
  ) VALUES (
    v_normalized,
    p_handle,
    p_phone,
    p_customer_id,
    p_order_id,
    p_paid_at
  )
  ON CONFLICT (instagram_handle_normalized) DO UPDATE SET
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), instagram_identities.phone),
    customer_id = COALESCE(EXCLUDED.customer_id, instagram_identities.customer_id),
    last_order_id = COALESCE(EXCLUDED.last_order_id, instagram_identities.last_order_id),
    last_paid_at = COALESCE(EXCLUDED.last_paid_at, instagram_identities.last_paid_at),
    instagram_handle_raw = COALESCE(NULLIF(EXCLUDED.instagram_handle_raw, ''), instagram_identities.instagram_handle_raw),
    updated_at = now();
END;
$$;

-- 5) Grant execute to anon and authenticated for the RPCs
GRANT EXECUTE ON FUNCTION public.get_live_checkout(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_live_checkout_details(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_instagram_identity(TEXT, TEXT, UUID, TIMESTAMP WITH TIME ZONE, UUID) TO anon, authenticated;
