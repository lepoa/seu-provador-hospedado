-- =============================================
-- LE.POÁ CLUB - LOYALTY PROGRAM DATABASE SCHEMA
-- =============================================

-- Create loyalty tier enum
CREATE TYPE public.loyalty_tier AS ENUM ('poa', 'classica', 'icone', 'atelier');

-- Create point transaction type enum
CREATE TYPE public.point_transaction_type AS ENUM (
  'purchase',      -- Points from paid orders
  'mission',       -- Points from completing missions
  'redemption',    -- Points spent on rewards
  'expiration',    -- Points expired after 12 months
  'reversal',      -- Points removed due to order cancellation
  'bonus',         -- Promotional bonus points
  'adjustment'     -- Manual admin adjustment
);

-- Create reward type enum
CREATE TYPE public.reward_type AS ENUM (
  'discount_fixed',      -- Fixed R$ discount
  'discount_percentage', -- Percentage discount
  'free_shipping',       -- Free shipping
  'gift',                -- Physical gift item
  'vip_access'           -- Early access / VIP perks
);

-- =============================================
-- 1. CUSTOMER LOYALTY - Main balance & tier tracking
-- =============================================
CREATE TABLE public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Current redeemable points
  current_points INTEGER NOT NULL DEFAULT 0,
  
  -- Total points earned all-time (never decreases except reversals)
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  
  -- Points earned this calendar year (for tier calculation)
  annual_points INTEGER NOT NULL DEFAULT 0,
  annual_points_reset_at TIMESTAMP WITH TIME ZONE,
  
  -- Current tier
  current_tier loyalty_tier NOT NULL DEFAULT 'poa',
  tier_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Mission points tracking (weekly limit enforcement)
  weekly_mission_points INTEGER NOT NULL DEFAULT 0,
  weekly_mission_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- =============================================
-- 2. POINT TRANSACTIONS - Full history of all point movements
-- =============================================
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction details
  type point_transaction_type NOT NULL,
  points INTEGER NOT NULL, -- Positive = earn, Negative = spend/expire
  description TEXT,
  
  -- References (depending on type)
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  mission_id TEXT,
  reward_id UUID, -- Will reference loyalty_rewards
  redemption_id UUID, -- Will reference reward_redemptions
  
  -- For earned points: when they expire
  expires_at TIMESTAMP WITH TIME ZONE,
  expired BOOLEAN NOT NULL DEFAULT false,
  
  -- Multiplier applied (for tier bonuses)
  multiplier NUMERIC(3,2) DEFAULT 1.0,
  base_points INTEGER, -- Original points before multiplier
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 3. LOYALTY REWARDS - Catalog of redeemable rewards
-- =============================================
CREATE TABLE public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Reward type and value
  type reward_type NOT NULL,
  points_cost INTEGER NOT NULL,
  
  -- For discount types
  discount_value NUMERIC, -- Amount or percentage
  
  -- Minimum tier required to redeem
  min_tier loyalty_tier NOT NULL DEFAULT 'poa',
  
  -- Stock management
  stock_qty INTEGER,
  unlimited_stock BOOLEAN NOT NULL DEFAULT false,
  
  -- Availability
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  user_id UUID REFERENCES auth.users(id), -- Merchant who created
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 4. REWARD REDEMPTIONS - Track when users redeem rewards
-- =============================================
CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id),
  
  -- Points spent
  points_spent INTEGER NOT NULL,
  
  -- Generated coupon code for checkout use
  coupon_code TEXT NOT NULL UNIQUE,
  
  -- Discount/benefit details (snapshot at redemption time)
  reward_type reward_type NOT NULL,
  discount_value NUMERIC,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'used', 'expired', 'cancelled'
  used_at TIMESTAMP WITH TIME ZONE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  -- Expiration (e.g., 30 days after redemption)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for point_transactions.reward_id now that table exists
ALTER TABLE public.point_transactions 
  ADD CONSTRAINT point_transactions_reward_id_fkey 
  FOREIGN KEY (reward_id) REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL;

ALTER TABLE public.point_transactions 
  ADD CONSTRAINT point_transactions_redemption_id_fkey 
  FOREIGN KEY (redemption_id) REFERENCES public.reward_redemptions(id) ON DELETE SET NULL;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Customer Loyalty: Users can view/manage their own record
CREATE POLICY "Users can view own loyalty" ON public.customer_loyalty
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own loyalty" ON public.customer_loyalty
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert loyalty records" ON public.customer_loyalty
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Merchants can view all loyalty" ON public.customer_loyalty
  FOR SELECT USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can manage loyalty" ON public.customer_loyalty
  FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Point Transactions: Users view own, merchants view all
CREATE POLICY "Users can view own transactions" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON public.point_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Merchants can view all transactions" ON public.point_transactions
  FOR SELECT USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can manage transactions" ON public.point_transactions
  FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Loyalty Rewards: Anyone can view active, merchants manage
CREATE POLICY "Anyone can view active rewards" ON public.loyalty_rewards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Merchants can manage rewards" ON public.loyalty_rewards
  FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Reward Redemptions: Users manage own
CREATE POLICY "Users can view own redemptions" ON public.reward_redemptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create redemptions" ON public.reward_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own redemptions" ON public.reward_redemptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Merchants can view all redemptions" ON public.reward_redemptions
  FOR SELECT USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can manage redemptions" ON public.reward_redemptions
  FOR ALL USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_customer_loyalty_user_id ON public.customer_loyalty(user_id);
CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX idx_point_transactions_type ON public.point_transactions(type);
CREATE INDEX idx_point_transactions_expires_at ON public.point_transactions(expires_at) WHERE expired = false;
CREATE INDEX idx_loyalty_rewards_active ON public.loyalty_rewards(is_active) WHERE is_active = true;
CREATE INDEX idx_reward_redemptions_user_id ON public.reward_redemptions(user_id);
CREATE INDEX idx_reward_redemptions_coupon ON public.reward_redemptions(coupon_code);
CREATE INDEX idx_reward_redemptions_status ON public.reward_redemptions(status);

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE TRIGGER update_customer_loyalty_updated_at
  BEFORE UPDATE ON public.customer_loyalty
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_rewards_updated_at
  BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Calculate tier based on annual points
CREATE OR REPLACE FUNCTION public.calculate_loyalty_tier(p_annual_points INTEGER)
RETURNS loyalty_tier
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_annual_points >= 10000 THEN 'atelier'::loyalty_tier
    WHEN p_annual_points >= 3000 THEN 'icone'::loyalty_tier
    WHEN p_annual_points >= 1000 THEN 'classica'::loyalty_tier
    ELSE 'poa'::loyalty_tier
  END
$$;

-- Get tier multiplier
CREATE OR REPLACE FUNCTION public.get_tier_multiplier(p_tier loyalty_tier)
RETURNS NUMERIC(3,2)
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_tier
    WHEN 'atelier' THEN 1.3
    WHEN 'icone' THEN 1.2
    WHEN 'classica' THEN 1.1
    ELSE 1.0
  END
$$;

-- Generate unique coupon code
CREATE OR REPLACE FUNCTION public.generate_reward_coupon()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code like 'LP-XXXXX' where X is alphanumeric
    new_code := 'LP-' || upper(substring(md5(random()::text) from 1 for 6));
    
    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM public.reward_redemptions WHERE coupon_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Insert some sample rewards
INSERT INTO public.loyalty_rewards (name, description, type, points_cost, discount_value, min_tier, unlimited_stock, is_active, is_featured) VALUES
  ('R$ 15 de Desconto', 'Use em qualquer compra acima de R$ 100', 'discount_fixed', 500, 15, 'poa', true, true, true),
  ('R$ 35 de Desconto', 'Use em qualquer compra acima de R$ 200', 'discount_fixed', 1000, 35, 'poa', true, true, true),
  ('R$ 50 de Desconto', 'Use em qualquer compra acima de R$ 300', 'discount_fixed', 1500, 50, 'classica', true, true, false),
  ('Frete Grátis', 'Válido para envios em todo Brasil', 'free_shipping', 700, null, 'poa', true, true, true),
  ('Acesso VIP - Lançamento', 'Acesso antecipado à próxima coleção', 'vip_access', 2000, null, 'icone', false, true, false);