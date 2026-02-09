-- ===========================================
-- LIVE SHOP MODULE - DATABASE SCHEMA
-- ===========================================

-- 1. ENUMS
-- -----------------------------------------

-- Live event status
CREATE TYPE public.live_event_status AS ENUM (
  'planejada',
  'ao_vivo', 
  'encerrada',
  'arquivada'
);

-- Product visibility in live
CREATE TYPE public.live_product_visibility AS ENUM (
  'exclusivo_live',
  'catalogo_e_live'
);

-- Live customer status
CREATE TYPE public.live_customer_status AS ENUM (
  'ativo',
  'parou',
  'finalizado',
  'cancelado'
);

-- Live cart status
CREATE TYPE public.live_cart_status AS ENUM (
  'aberto',
  'em_confirmacao',
  'aguardando_pagamento',
  'pago',
  'cancelado',
  'expirado'
);

-- Live cart item status
CREATE TYPE public.live_cart_item_status AS ENUM (
  'reservado',
  'confirmado',
  'removido',
  'substituido',
  'cancelado',
  'expirado'
);

-- Waitlist status
CREATE TYPE public.live_waitlist_status AS ENUM (
  'ativa',
  'chamada',
  'atendida',
  'cancelada'
);

-- 2. TABLES
-- -----------------------------------------

-- 2.1 LiveEvent (evento da live)
CREATE TABLE public.live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_hora_fim TIMESTAMP WITH TIME ZONE,
  status public.live_event_status NOT NULL DEFAULT 'planejada',
  observacoes TEXT,
  reservation_expiry_minutes INTEGER NOT NULL DEFAULT 30,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2.2 LiveProduct (produto selecionado para a live)
CREATE TABLE public.live_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  prioridade_ordem INTEGER NOT NULL DEFAULT 0,
  visibilidade public.live_product_visibility NOT NULL DEFAULT 'catalogo_e_live',
  bloquear_desde_planejamento BOOLEAN NOT NULL DEFAULT false,
  limite_unidades_live INTEGER,
  snapshot_variantes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(live_event_id, product_id)
);

-- 2.3 LiveCustomer (cliente por @ durante a live)
CREATE TABLE public.live_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.customers(id),
  instagram_handle TEXT NOT NULL,
  nome TEXT,
  whatsapp TEXT,
  status public.live_customer_status NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(live_event_id, instagram_handle)
);

-- 2.4 LiveCart (carrinho da live por cliente)
CREATE TABLE public.live_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  live_customer_id UUID NOT NULL REFERENCES public.live_customers(id) ON DELETE CASCADE,
  status public.live_cart_status NOT NULL DEFAULT 'aberto',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  descontos NUMERIC NOT NULL DEFAULT 0,
  frete NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  order_id UUID REFERENCES public.orders(id),
  mp_preference_id TEXT,
  mp_checkout_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(live_event_id, live_customer_id)
);

-- 2.5 LiveCartItem (itens do carrinho)
CREATE TABLE public.live_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_cart_id UUID NOT NULL REFERENCES public.live_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.product_catalog(id),
  variante JSONB NOT NULL DEFAULT '{}'::jsonb,
  qtd INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL,
  status public.live_cart_item_status NOT NULL DEFAULT 'reservado',
  reservado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expiracao_reserva_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2.6 Waitlist (lista de espera por variante)
CREATE TABLE public.live_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.product_catalog(id),
  variante JSONB NOT NULL DEFAULT '{}'::jsonb,
  instagram_handle TEXT NOT NULL,
  whatsapp TEXT,
  ordem SERIAL,
  status public.live_waitlist_status NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. ADD instagram_handle TO CUSTOMERS TABLE
-- -----------------------------------------
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- 4. INDEXES
-- -----------------------------------------
CREATE INDEX idx_live_events_status ON public.live_events(status);
CREATE INDEX idx_live_events_data_hora ON public.live_events(data_hora_inicio);
CREATE INDEX idx_live_products_event ON public.live_products(live_event_id);
CREATE INDEX idx_live_products_product ON public.live_products(product_id);
CREATE INDEX idx_live_customers_event ON public.live_customers(live_event_id);
CREATE INDEX idx_live_customers_instagram ON public.live_customers(instagram_handle);
CREATE INDEX idx_live_carts_event ON public.live_carts(live_event_id);
CREATE INDEX idx_live_carts_customer ON public.live_carts(live_customer_id);
CREATE INDEX idx_live_carts_status ON public.live_carts(status);
CREATE INDEX idx_live_cart_items_cart ON public.live_cart_items(live_cart_id);
CREATE INDEX idx_live_cart_items_product ON public.live_cart_items(product_id);
CREATE INDEX idx_live_cart_items_status ON public.live_cart_items(status);
CREATE INDEX idx_live_waitlist_event ON public.live_waitlist(live_event_id);
CREATE INDEX idx_live_waitlist_product ON public.live_waitlist(product_id);
CREATE INDEX idx_live_waitlist_status ON public.live_waitlist(status);

-- 5. TRIGGERS FOR updated_at
-- -----------------------------------------
CREATE TRIGGER update_live_events_updated_at
  BEFORE UPDATE ON public.live_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_products_updated_at
  BEFORE UPDATE ON public.live_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_customers_updated_at
  BEFORE UPDATE ON public.live_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_carts_updated_at
  BEFORE UPDATE ON public.live_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_cart_items_updated_at
  BEFORE UPDATE ON public.live_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_waitlist_updated_at
  BEFORE UPDATE ON public.live_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. ROW LEVEL SECURITY
-- -----------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_waitlist ENABLE ROW LEVEL SECURITY;

-- Policies for live_events
CREATE POLICY "Merchants can manage live events"
  ON public.live_events FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Policies for live_products
CREATE POLICY "Merchants can manage live products"
  ON public.live_products FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Policies for live_customers
CREATE POLICY "Merchants can manage live customers"
  ON public.live_customers FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Policies for live_carts
CREATE POLICY "Merchants can manage live carts"
  ON public.live_carts FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Policies for live_cart_items
CREATE POLICY "Merchants can manage live cart items"
  ON public.live_cart_items FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Policies for live_waitlist
CREATE POLICY "Merchants can manage live waitlist"
  ON public.live_waitlist FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- 7. FUNCTION TO CALCULATE RESERVED STOCK FOR A PRODUCT/VARIANT
-- -----------------------------------------
CREATE OR REPLACE FUNCTION public.get_live_reserved_stock(
  p_product_id UUID,
  p_size TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(lci.qtd), 0)::INTEGER
  FROM public.live_cart_items lci
  JOIN public.live_carts lc ON lc.id = lci.live_cart_id
  JOIN public.live_events le ON le.id = lc.live_event_id
  WHERE lci.product_id = p_product_id
    AND lci.variante->>'tamanho' = p_size
    AND lci.status IN ('reservado', 'confirmado')
    AND le.status IN ('planejada', 'ao_vivo')
$$;

-- 8. FUNCTION TO CHECK IF PRODUCT IS HIDDEN FROM CATALOG
-- -----------------------------------------
CREATE OR REPLACE FUNCTION public.is_product_hidden_by_live(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.live_products lp
    JOIN public.live_events le ON le.id = lp.live_event_id
    WHERE lp.product_id = p_product_id
      AND lp.visibilidade = 'exclusivo_live'
      AND (
        (le.status = 'ao_vivo')
        OR (le.status = 'planejada' AND lp.bloquear_desde_planejamento = true)
      )
  )
$$;

-- 9. ADD live_event_id TO ORDERS FOR TRACKING
-- -----------------------------------------
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS live_event_id UUID REFERENCES public.live_events(id);