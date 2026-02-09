-- =====================================================
-- GIFTS SYSTEM - Complete Schema
-- =====================================================

-- 1) GIFTS TABLE - Cadastro de brindes
CREATE TABLE public.gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  sku TEXT UNIQUE,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  unlimited_stock BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  require_manual_confirm BOOLEAN NOT NULL DEFAULT false,
  cost NUMERIC DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) GIFT_RULES TABLE - Regras automáticas de brindes
CREATE TYPE public.gift_channel_scope AS ENUM ('catalog_only', 'live_only', 'both', 'live_specific');
CREATE TYPE public.gift_condition_type AS ENUM ('all_purchases', 'min_value', 'first_n_paid', 'first_n_reserved');

CREATE TABLE public.gift_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  channel_scope public.gift_channel_scope NOT NULL DEFAULT 'both',
  live_event_id UUID REFERENCES public.live_events(id) ON DELETE CASCADE,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  priority INTEGER NOT NULL DEFAULT 0,
  condition_type public.gift_condition_type NOT NULL DEFAULT 'all_purchases',
  condition_value NUMERIC, -- min value for min_value, N for first_n_*
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  gift_qty INTEGER NOT NULL DEFAULT 1,
  max_per_customer INTEGER DEFAULT 1,
  max_total_awards INTEGER,
  current_awards_count INTEGER NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3) ORDER_GIFTS TABLE - Brindes aplicados em pedidos/carrinhos
CREATE TYPE public.order_gift_status AS ENUM ('pending_separation', 'separated', 'removed', 'out_of_stock');

CREATE TABLE public.order_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  live_cart_id UUID REFERENCES public.live_carts(id) ON DELETE CASCADE,
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  status public.order_gift_status NOT NULL DEFAULT 'pending_separation',
  applied_by_rule_id UUID REFERENCES public.gift_rules(id) ON DELETE SET NULL,
  applied_by_raffle_id UUID,
  separation_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure either order_id or live_cart_id is set
  CONSTRAINT order_gifts_target_check CHECK (order_id IS NOT NULL OR live_cart_id IS NOT NULL)
);

-- 4) LIVE_RAFFLES TABLE - Sorteios ao vivo
CREATE TABLE public.live_raffles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  winner_live_cart_id UUID REFERENCES public.live_carts(id) ON DELETE SET NULL,
  winner_bag_number INTEGER,
  winner_instagram_handle TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update order_gifts to reference live_raffles
ALTER TABLE public.order_gifts 
ADD CONSTRAINT order_gifts_raffle_fkey 
FOREIGN KEY (applied_by_raffle_id) REFERENCES public.live_raffles(id) ON DELETE SET NULL;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_gifts_active ON public.gifts(is_active);
CREATE INDEX idx_gifts_sku ON public.gifts(sku);
CREATE INDEX idx_gift_rules_active ON public.gift_rules(is_active);
CREATE INDEX idx_gift_rules_live ON public.gift_rules(live_event_id);
CREATE INDEX idx_gift_rules_priority ON public.gift_rules(priority DESC);
CREATE INDEX idx_order_gifts_order ON public.order_gifts(order_id);
CREATE INDEX idx_order_gifts_cart ON public.order_gifts(live_cart_id);
CREATE INDEX idx_order_gifts_status ON public.order_gifts(status);
CREATE INDEX idx_live_raffles_event ON public.live_raffles(live_event_id);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_gifts_updated_at
  BEFORE UPDATE ON public.gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gift_rules_updated_at
  BEFORE UPDATE ON public.gift_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_gifts_updated_at
  BEFORE UPDATE ON public.order_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_raffles ENABLE ROW LEVEL SECURITY;

-- GIFTS policies
CREATE POLICY "Merchants can manage gifts"
  ON public.gifts FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- GIFT_RULES policies
CREATE POLICY "Merchants can manage gift rules"
  ON public.gift_rules FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- ORDER_GIFTS policies
CREATE POLICY "Merchants can manage order gifts"
  ON public.order_gifts FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own order gifts"
  ON public.order_gifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = order_gifts.order_id AND o.user_id = auth.uid()
    )
  );

-- LIVE_RAFFLES policies
CREATE POLICY "Merchants can manage live raffles"
  ON public.live_raffles FOR ALL
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- =====================================================
-- FUNCTION: Generate gift SKU
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_gift_sku()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM 6) AS INTEGER)), 0) + 1 
    INTO next_num 
    FROM public.gifts 
    WHERE sku LIKE 'GIFT-%';
    
    NEW.sku := 'GIFT-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_gift_sku_trigger
  BEFORE INSERT ON public.gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_gift_sku();

-- =====================================================
-- FUNCTION: Decrement gift stock
-- =====================================================
CREATE OR REPLACE FUNCTION public.decrement_gift_stock(p_gift_id UUID, p_qty INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  v_unlimited BOOLEAN;
  v_current_stock INTEGER;
BEGIN
  SELECT unlimited_stock, stock_qty INTO v_unlimited, v_current_stock
  FROM public.gifts WHERE id = p_gift_id FOR UPDATE;
  
  IF v_unlimited THEN
    RETURN TRUE;
  END IF;
  
  IF v_current_stock >= p_qty THEN
    UPDATE public.gifts SET stock_qty = stock_qty - p_qty WHERE id = p_gift_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- FUNCTION: Increment gift rule awards count
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_gift_rule_awards(p_rule_id UUID, p_qty INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_awards INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT max_total_awards, current_awards_count INTO v_max_awards, v_current_count
  FROM public.gift_rules WHERE id = p_rule_id FOR UPDATE;
  
  IF v_max_awards IS NULL OR v_current_count + p_qty <= v_max_awards THEN
    UPDATE public.gift_rules SET current_awards_count = current_awards_count + p_qty WHERE id = p_rule_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;