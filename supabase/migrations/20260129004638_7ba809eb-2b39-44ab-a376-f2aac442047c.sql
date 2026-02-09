-- =====================================================
-- LE.POÁ CLUB - COMPLETE LOYALTY SYSTEM
-- =====================================================

-- 1) LOYALTY TIERS TABLE (CRUD configurable)
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  min_points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  benefits TEXT,
  badge_color TEXT DEFAULT '#8B7355',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default tiers
INSERT INTO public.loyalty_tiers (name, slug, min_points, max_points, multiplier, benefits, badge_color, display_order)
VALUES 
  ('Poá', 'poa', 0, 999, 1.0, 'Acumule pontos a cada compra', '#D4C4B0', 1),
  ('Clássica', 'classica', 1000, 2999, 1.1, 'Multiplicador 1.1x, Ofertas antecipadas', '#C9A86C', 2),
  ('Ícone', 'icone', 3000, 9999, 1.2, 'Multiplicador 1.2x, Frete grátis em promoções', '#8B7355', 3),
  ('Atelier', 'atelier', 10000, NULL, 1.3, 'Multiplicador 1.3x, Acesso VIP, Presentes exclusivos', '#5C4033', 4)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers" ON public.loyalty_tiers
FOR SELECT USING (is_active = true);

CREATE POLICY "Merchants can manage tiers" ON public.loyalty_tiers
FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- 2) LOYALTY CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.loyalty_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('multiplier', 'bonus_points', 'auto_gift', 'mission_bonus')),
  multiplier_value NUMERIC DEFAULT 1.0,
  bonus_points INTEGER DEFAULT 0,
  gift_id UUID REFERENCES public.gifts(id),
  min_order_value NUMERIC,
  applicable_tiers TEXT[] DEFAULT ARRAY['poa', 'classica', 'icone', 'atelier'],
  channel_scope TEXT NOT NULL DEFAULT 'both' CHECK (channel_scope IN ('live', 'catalog', 'both')),
  category_filter TEXT[],
  sku_filter TEXT[],
  priority INTEGER NOT NULL DEFAULT 0,
  max_uses_per_customer INTEGER,
  max_total_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage campaigns" ON public.loyalty_campaigns
FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- 3) MISSIONS TABLE (CRUD configurable)
CREATE TABLE IF NOT EXISTS public.loyalty_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  emoji TEXT DEFAULT '🎯',
  description TEXT,
  points_reward INTEGER NOT NULL DEFAULT 50,
  mission_type TEXT NOT NULL DEFAULT 'quiz' CHECK (mission_type IN ('quiz', 'profile_update', 'photo_upload', 'first_purchase', 'review')),
  questions_json JSONB DEFAULT '[]'::jsonb,
  max_photos INTEGER DEFAULT 5,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  repeat_interval_days INTEGER,
  prerequisite_mission_id UUID REFERENCES public.loyalty_missions(id),
  min_tier TEXT DEFAULT 'poa',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published missions" ON public.loyalty_missions
FOR SELECT USING (is_published = true AND is_active = true);

CREATE POLICY "Merchants can manage missions" ON public.loyalty_missions
FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- 4) MISSION RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.mission_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id UUID NOT NULL REFERENCES public.loyalty_missions(id) ON DELETE CASCADE,
  answers_json JSONB DEFAULT '[]'::jsonb,
  images_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  points_earned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'expired')),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own responses" ON public.mission_responses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own responses" ON public.mission_responses
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants can view all responses" ON public.mission_responses
FOR SELECT USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- 5) LOYALTY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Insert default settings
INSERT INTO public.loyalty_settings (setting_key, setting_value)
VALUES 
  ('general', '{"enabled": true, "points_per_real": 1, "points_expiry_months": 12, "weekly_mission_limit": 300}'::jsonb),
  ('messages', '{"welcome": "Bem-vinda ao Le.Poá Club!", "level_up": "Parabéns! Você subiu de nível!", "points_earned": "Você ganhou {points} pontos!", "points_expiring": "Seus pontos expiram em {days} dias"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.loyalty_settings
FOR SELECT USING (true);

CREATE POLICY "Merchants can manage settings" ON public.loyalty_settings
FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- 6) UPDATE LOYALTY_REWARDS TABLE (add redemption type)
ALTER TABLE public.loyalty_rewards ADD COLUMN IF NOT EXISTS reward_mode TEXT NOT NULL DEFAULT 'redemption' CHECK (reward_mode IN ('redemption', 'auto_gift'));
ALTER TABLE public.loyalty_rewards ADD COLUMN IF NOT EXISTS min_order_value NUMERIC;
ALTER TABLE public.loyalty_rewards ADD COLUMN IF NOT EXISTS max_per_customer INTEGER DEFAULT 1;
ALTER TABLE public.loyalty_rewards ADD COLUMN IF NOT EXISTS current_redemptions INTEGER NOT NULL DEFAULT 0;

-- 7) UPDATE POINT_TRANSACTIONS TABLE (add more tracking)
ALTER TABLE public.point_transactions ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.loyalty_campaigns(id);
ALTER TABLE public.point_transactions ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('order', 'mission', 'campaign', 'manual', 'expiration', 'reversal'));
ALTER TABLE public.point_transactions ADD COLUMN IF NOT EXISTS adjusted_by UUID;
ALTER TABLE public.point_transactions ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;

-- 8) LOYALTY REPORTS VIEW (for analytics)
CREATE OR REPLACE VIEW public.loyalty_reports_summary AS
SELECT 
  DATE_TRUNC('month', pt.created_at) as month,
  SUM(CASE WHEN pt.points > 0 THEN pt.points ELSE 0 END) as points_earned,
  SUM(CASE WHEN pt.points < 0 AND pt.type = 'redemption' THEN ABS(pt.points) ELSE 0 END) as points_redeemed,
  SUM(CASE WHEN pt.expired = true THEN pt.points ELSE 0 END) as points_expired,
  COUNT(DISTINCT pt.user_id) as active_users
FROM public.point_transactions pt
GROUP BY DATE_TRUNC('month', pt.created_at)
ORDER BY month DESC;

-- 9) Function to calculate points for order
CREATE OR REPLACE FUNCTION public.calculate_order_points(
  p_order_total NUMERIC,
  p_user_tier TEXT DEFAULT 'poa'
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_base_points INTEGER;
  v_multiplier NUMERIC;
  v_settings JSONB;
BEGIN
  -- Get points per real from settings
  SELECT setting_value INTO v_settings FROM public.loyalty_settings WHERE setting_key = 'general';
  v_base_points := FLOOR(p_order_total * COALESCE((v_settings->>'points_per_real')::NUMERIC, 1));
  
  -- Get tier multiplier
  SELECT multiplier INTO v_multiplier FROM public.loyalty_tiers WHERE slug = p_user_tier AND is_active = true;
  v_multiplier := COALESCE(v_multiplier, 1.0);
  
  RETURN FLOOR(v_base_points * v_multiplier);
END;
$$;

-- 10) Triggers for updated_at
CREATE OR REPLACE TRIGGER update_loyalty_tiers_updated_at
BEFORE UPDATE ON public.loyalty_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_loyalty_campaigns_updated_at
BEFORE UPDATE ON public.loyalty_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_loyalty_missions_updated_at
BEFORE UPDATE ON public.loyalty_missions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_loyalty_settings_updated_at
BEFORE UPDATE ON public.loyalty_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();