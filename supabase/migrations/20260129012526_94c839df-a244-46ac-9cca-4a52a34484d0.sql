-- ============================================
-- Le.Poá Club - Complete Schema & Seed Data (Fixed)
-- ============================================

-- First, add 'poa_black' to the loyalty_tier enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'poa_black' AND enumtypid = 'public.loyalty_tier'::regtype) THEN
    ALTER TYPE public.loyalty_tier ADD VALUE 'poa_black';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add no_expiry flag to loyalty_tiers for Black tier
ALTER TABLE public.loyalty_tiers 
ADD COLUMN IF NOT EXISTS no_expiry boolean NOT NULL DEFAULT false;

-- Add channel field to loyalty_rewards for catalog/live separation
ALTER TABLE public.loyalty_rewards 
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'catalog',
ADD COLUMN IF NOT EXISTS max_per_customer_30d integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS min_order_value_cents integer DEFAULT 0;

-- Add channel to loyalty_campaigns
ALTER TABLE public.loyalty_campaigns 
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'both';

-- Add base_points and multiplier tracking to point_transactions
ALTER TABLE public.point_transactions
ADD COLUMN IF NOT EXISTS base_points integer,
ADD COLUMN IF NOT EXISTS multiplier numeric(3,2) DEFAULT 1.00;

-- Update loyalty_settings with proper structure
DELETE FROM public.loyalty_settings WHERE setting_key IN ('general', 'messages');

INSERT INTO public.loyalty_settings (setting_key, setting_value) VALUES
('general', '{
  "enabled": true,
  "points_per_real": 1,
  "points_expiry_months": 12,
  "weekly_mission_limit": 300
}'::jsonb),
('messages', '{
  "welcome": "Bem-vinda ao Le.Poá Club. Quanto mais você compra e responde, mais vantagens você destrava.",
  "level_up": "Parabéns! Você subiu de nível no Le.Poá Club.",
  "points_earned": "Você ganhou {points} Poás no Le.Poá Club.",
  "points_expiring": "Atenção: {points} Poás expiram em {days} dias."
}'::jsonb);

-- Clear and seed tiers
DELETE FROM public.loyalty_tiers;

INSERT INTO public.loyalty_tiers (slug, name, min_points, max_points, multiplier, benefits, badge_color, display_order, is_active, no_expiry) VALUES
('poa', 'Poá', 0, 999, 1.0, 'Acesso ao clube de vantagens
Acumule 1 Poá por real gasto
Missões exclusivas para ganhar mais pontos', '#8B7355', 0, true, false),
('classica', 'Clássica', 1000, 2999, 1.1, 'Multiplicador 1.1x nos pontos
Acesso antecipado a promoções
Frete grátis acima de R$ 350', '#C4A77D', 1, true, false),
('icone', 'Ícone', 3000, 5999, 1.2, 'Multiplicador 1.2x nos pontos
Prioridade em lançamentos
Brindes exclusivos
Atendimento prioritário', '#D4AF37', 2, true, false),
('poa_black', 'Poá Black', 6000, NULL, 1.3, 'Multiplicador 1.3x nos pontos
Pontos nunca expiram
Convites VIP para eventos
Presentes surpresa
Consultoria de estilo exclusiva', '#1A1A1A', 3, true, true);

-- Clear and seed missions
DELETE FROM public.loyalty_missions;

INSERT INTO public.loyalty_missions (mission_key, emoji, title, subtitle, description, points_reward, mission_type, is_repeatable, repeat_interval_days, display_order, is_active, is_published, min_tier, questions_json) VALUES
('mission_trabalho', '🎯', 'Estilo de Trabalho', 'Como você se veste no dia a dia profissional?', 'Responda perguntas sobre seu estilo de trabalho para recebermos sugestões personalizadas.', 120, 'quiz', false, NULL, 0, true, true, 'poa', '[{"question": "Como é o dress code do seu trabalho?", "options": ["Formal", "Business casual", "Casual", "Criativo/Livre"]},{"question": "Quantos dias por semana você vai ao escritório?", "options": ["5 dias", "3-4 dias", "1-2 dias", "Home office"]},{"question": "Prefere looks que vão do trabalho para happy hour?", "options": ["Sim, sempre", "Às vezes", "Raramente"]}]'::jsonb),
('mission_fds', '☀️', 'Estilo de Fim de Semana', 'O que você gosta de fazer nos fins de semana?', 'Conte sobre suas atividades de lazer para sugerirmos looks perfeitos.', 120, 'quiz', false, NULL, 1, true, true, 'poa', '[{"question": "Como são seus fins de semana típicos?", "options": ["Tranquilos em casa", "Atividades ao ar livre", "Passeios e restaurantes", "Eventos sociais"]},{"question": "Que tipo de roupa você mais usa no fim de semana?", "options": ["Jeans e camiseta", "Vestidos/saias", "Looks esportivos", "Depende da ocasião"]}]'::jsonb),
('mission_cores', '🎨', 'Paleta de Cores', 'Quais cores combinam mais com você?', 'Descubra sua cartela de cores ideal.', 80, 'quiz', false, NULL, 2, true, true, 'poa', '[{"question": "Qual tom de pele você tem?", "options": ["Muito claro", "Claro", "Médio", "Escuro"]},{"question": "Que cores você mais usa no dia a dia?", "options": ["Neutras (preto, branco, bege)", "Terrosas (marrom, verde)", "Vibrantes (vermelho, amarelo)", "Pastéis (rosa, azul claro)"]},{"question": "Que cores você evita?", "options": ["Cores muito claras", "Cores muito escuras", "Cores vibrantes", "Nenhuma, uso de tudo"]}]'::jsonb),
('mission_tamanhos', '📏', 'Minhas Medidas', 'Cadastre suas medidas para looks perfeitos', 'Informe suas medidas para encontrarmos o tamanho ideal.', 60, 'profile_update', false, NULL, 3, true, true, 'poa', '[]'::jsonb),
('mission_endereco', '📦', 'Endereço Completo', 'Complete seu cadastro de entrega', 'Mantenha seu endereço atualizado para entregas mais rápidas.', 40, 'profile_update', false, NULL, 4, true, true, 'poa', '[]'::jsonb),
('mission_pos_compra', '✨', 'Feedback Pós-Compra', 'Conte como foi sua experiência', 'Avalie seus últimos looks e ajude outras clientes.', 100, 'review', true, 30, 5, true, true, 'poa', '[{"question": "Como foi sua experiência geral?", "options": ["Excelente", "Boa", "Regular", "Ruim"]},{"question": "A peça serviu como esperado?", "options": ["Sim, perfeito", "Um pouco diferente", "Precisei trocar"]},{"question": "Você indicaria para uma amiga?", "options": ["Com certeza", "Talvez", "Não"]}]'::jsonb),
('mission_ocasiao', '🌟', 'Ocasião do Mês', 'Tem algum evento especial este mês?', 'Conte sobre seus próximos eventos para sugestões especiais.', 50, 'quiz', true, 30, 6, true, true, 'poa', '[{"question": "Você tem algum evento especial este mês?", "options": ["Casamento/festa", "Aniversário", "Viagem", "Reunião importante", "Nenhum especial"]},{"question": "Que tipo de look você está buscando?", "options": ["Elegante/formal", "Casual chique", "Confortável", "Ousado/diferente"]}]'::jsonb),
('mission_estilo_update', '🔄', 'Atualizar Estilo', 'Seu estilo mudou? Conte para nós!', 'Atualize suas preferências para sugestões mais precisas.', 80, 'quiz', true, 30, 7, true, true, 'poa', '[{"question": "Houve alguma mudança no seu estilo recentemente?", "options": ["Sim, estou mais ousada", "Sim, estou mais clássica", "Sim, estou mais casual", "Não, continuo a mesma"]},{"question": "O que você está buscando agora?", "options": ["Renovar o guarda-roupa", "Peças-chave versáteis", "Looks para ocasiões especiais", "Apenas manter o estilo"]}]'::jsonb);

-- Clear and seed rewards (using 'poa' as min_tier for most, 'classica' and 'icone' for premium)
DELETE FROM public.loyalty_rewards;

INSERT INTO public.loyalty_rewards (name, description, type, points_cost, discount_value, min_tier, min_order_value, channel, max_per_customer, unlimited_stock, is_active, is_featured) VALUES
('Frete Grátis Anápolis', 'Entrega grátis por motoboy em Anápolis (ou R$ 10 off no frete)', 'free_shipping', 600, 10, 'poa', 199, 'catalog', 1, true, true, true),
('Cupom R$ 30', 'Desconto de R$ 30 em sua próxima compra', 'discount_fixed', 1200, 30, 'poa', 300, 'catalog', 1, true, true, true),
('Cupom R$ 70', 'Desconto de R$ 70 em sua próxima compra', 'discount_fixed', 2500, 70, 'classica', 450, 'catalog', 1, true, true, true),
('Cupom R$ 120', 'Desconto de R$ 120 em sua próxima compra', 'discount_fixed', 4000, 120, 'icone', 650, 'catalog', 1, true, true, true),
('Acesso VIP Lançamento', 'Compre antes de todo mundo na próxima coleção', 'vip_access', 2000, NULL, 'icone', NULL, 'catalog', 1, false, true, false),
('Consultoria de Estilo', 'Sessão exclusiva com nossa personal stylist', 'gift', 5000, NULL, 'icone', NULL, 'catalog', 1, false, true, false);

-- Create function to calculate points on order payment
CREATE OR REPLACE FUNCTION public.credit_loyalty_points_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_order_total numeric;
  v_base_points integer;
  v_multiplier numeric;
  v_tier_slug text;
  v_no_expiry boolean;
  v_expires_at timestamptz;
  v_loyalty_id uuid;
  v_points_per_real integer;
  v_expiry_months integer;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    v_user_id := NEW.user_id;
    
    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    v_order_total := NEW.subtotal;
    
    SELECT 
      COALESCE((setting_value->>'points_per_real')::integer, 1),
      COALESCE((setting_value->>'points_expiry_months')::integer, 12)
    INTO v_points_per_real, v_expiry_months
    FROM public.loyalty_settings
    WHERE setting_key = 'general';
    
    SELECT id, current_tier INTO v_loyalty_id, v_tier_slug
    FROM public.customer_loyalty
    WHERE user_id = v_user_id;
    
    IF v_loyalty_id IS NULL THEN
      INSERT INTO public.customer_loyalty (user_id, current_tier)
      VALUES (v_user_id, 'poa')
      RETURNING id, current_tier INTO v_loyalty_id, v_tier_slug;
    END IF;
    
    SELECT multiplier, no_expiry INTO v_multiplier, v_no_expiry
    FROM public.loyalty_tiers
    WHERE slug = v_tier_slug AND is_active = true;
    
    v_multiplier := COALESCE(v_multiplier, 1.0);
    v_no_expiry := COALESCE(v_no_expiry, false);
    
    v_base_points := FLOOR(v_order_total * v_points_per_real);
    
    IF v_no_expiry THEN
      v_expires_at := NULL;
    ELSE
      v_expires_at := now() + (v_expiry_months || ' months')::interval;
    END IF;
    
    INSERT INTO public.point_transactions (
      user_id,
      type,
      points,
      base_points,
      multiplier,
      description,
      order_id,
      expires_at
    ) VALUES (
      v_user_id,
      'earn',
      FLOOR(v_base_points * v_multiplier),
      v_base_points,
      v_multiplier,
      'Compra #' || COALESCE(NEW.order_number, LEFT(NEW.id::text, 8)),
      NEW.id,
      v_expires_at
    );
    
    UPDATE public.customer_loyalty
    SET 
      current_points = current_points + FLOOR(v_base_points * v_multiplier),
      lifetime_points = lifetime_points + FLOOR(v_base_points * v_multiplier),
      annual_points = annual_points + FLOOR(v_base_points * v_multiplier),
      updated_at = now()
    WHERE id = v_loyalty_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_credit_loyalty_on_order_payment ON public.orders;
CREATE TRIGGER trigger_credit_loyalty_on_order_payment
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.credit_loyalty_points_on_order();

-- Create function to reverse points on cancellation
CREATE OR REPLACE FUNCTION public.reverse_loyalty_points_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_earned_points integer;
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status = 'pago' AND NEW.user_id IS NOT NULL THEN
    SELECT points INTO v_earned_points
    FROM public.point_transactions
    WHERE order_id = NEW.id AND type = 'earn' AND NOT expired
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_earned_points IS NOT NULL AND v_earned_points > 0 THEN
      UPDATE public.point_transactions
      SET expired = true
      WHERE order_id = NEW.id AND type = 'earn';
      
      INSERT INTO public.point_transactions (
        user_id,
        type,
        points,
        description,
        order_id
      ) VALUES (
        NEW.user_id,
        'adjustment',
        -v_earned_points,
        'Estorno: Pedido cancelado',
        NEW.id
      );
      
      UPDATE public.customer_loyalty
      SET 
        current_points = GREATEST(0, current_points - v_earned_points),
        annual_points = GREATEST(0, annual_points - v_earned_points),
        updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_reverse_loyalty_on_cancel ON public.orders;
CREATE TRIGGER trigger_reverse_loyalty_on_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.reverse_loyalty_points_on_cancel();