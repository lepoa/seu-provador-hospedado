-- ============================================================
-- COPILOTO RFV – Motor de Recorrência Inteligente
-- Tabelas + Funções de cálculo + Geração de tarefas
-- ============================================================

-- 1. TABELA: customer_rfv_metrics
-- Armazena métricas RFV calculadas para cada cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_rfv_metrics (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,

  -- Métricas globais
  recency_days INT NOT NULL DEFAULT 0,
  frequency INT NOT NULL DEFAULT 0,
  monetary_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_ticket NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_cycle_days NUMERIC(8,1),
  cycle_stddev NUMERIC(8,1),
  repurchase_probability NUMERIC(3,2) DEFAULT 0,

  -- Scores RFV (quintis 1-5)
  r_score INT DEFAULT 1,
  f_score INT DEFAULT 1,
  v_score INT DEFAULT 1,
  rfv_segment TEXT DEFAULT 'novo',
  churn_risk TEXT DEFAULT 'baixo',

  -- Canal de compra
  purchase_channel TEXT DEFAULT 'site_only', -- live_only, site_only, hybrid
  live_order_count INT DEFAULT 0,
  site_order_count INT DEFAULT 0,
  live_total NUMERIC(12,2) DEFAULT 0,
  site_total NUMERIC(12,2) DEFAULT 0,
  live_avg_ticket NUMERIC(12,2) DEFAULT 0,
  site_avg_ticket NUMERIC(12,2) DEFAULT 0,
  last_live_purchase_at TIMESTAMPTZ,
  last_site_purchase_at TIMESTAMPTZ,
  preferred_channel TEXT DEFAULT 'site',

  -- Janela de contato
  ideal_contact_start DATE,
  ideal_contact_end DATE,

  -- Datas
  last_purchase_at TIMESTAMPTZ,
  first_purchase_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Novos campos Fase 5 (Preditivo)
  individual_cycle_avg_days NUMERIC(8,1),
  individual_cycle_std_dev NUMERIC(8,1),
  cycle_deviation_percent NUMERIC(5,2), -- (dias_desde_ultima / ciclo_individual)
  repurchase_probability_score INT DEFAULT 0 -- 0 a 100
);

-- MIGRATION: Adicionar colunas caso já existam
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='customer_rfv_metrics' AND COLUMN_NAME='individual_cycle_avg_days') THEN
    ALTER TABLE public.customer_rfv_metrics ADD COLUMN individual_cycle_avg_days NUMERIC(8,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='customer_rfv_metrics' AND COLUMN_NAME='individual_cycle_std_dev') THEN
    ALTER TABLE public.customer_rfv_metrics ADD COLUMN individual_cycle_std_dev NUMERIC(8,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='customer_rfv_metrics' AND COLUMN_NAME='cycle_deviation_percent') THEN
    ALTER TABLE public.customer_rfv_metrics ADD COLUMN cycle_deviation_percent NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='customer_rfv_metrics' AND COLUMN_NAME='repurchase_probability_score') THEN
    ALTER TABLE public.customer_rfv_metrics ADD COLUMN repurchase_probability_score INT DEFAULT 0;
  END IF;
END $$;

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_rfv_segment ON public.customer_rfv_metrics(rfv_segment);
CREATE INDEX IF NOT EXISTS idx_rfv_churn_risk ON public.customer_rfv_metrics(churn_risk);
CREATE INDEX IF NOT EXISTS idx_rfv_channel ON public.customer_rfv_metrics(purchase_channel);
CREATE INDEX IF NOT EXISTS idx_rfv_contact_window ON public.customer_rfv_metrics(ideal_contact_start, ideal_contact_end);

-- 2. TABELA: rfv_tasks
-- Tarefas geradas automaticamente pelo motor de decisão
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rfv_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  task_type TEXT NOT NULL, -- preventivo, reativacao, pos_compra, vip, perda_frequencia, migrar_canal
  task_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Coluna para controle diário imutável
  priority TEXT NOT NULL DEFAULT 'oportunidade', -- critico, importante, oportunidade
  reason TEXT NOT NULL,
  suggested_message TEXT NOT NULL,
  objective TEXT NOT NULL, -- reativar, manter, upsell, recuperar, migrar
  channel_context TEXT NOT NULL DEFAULT 'site', -- live, site, hybrid
  estimated_impact NUMERIC(12,2) DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, enviado, respondeu, converteu, sem_resposta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ,
  executed_by TEXT,
  expires_at TIMESTAMPTZ,

  -- Novos campos Fase 5 (Atribuição e Automação)
  revenue_generated NUMERIC(12,2) DEFAULT 0,
  converted_order_id UUID,
  conversion_timestamp TIMESTAMPTZ,
  automation_eligible BOOLEAN DEFAULT false,
  automation_sent BOOLEAN DEFAULT false,

  -- Agora o UNIQUE funciona perfeitamente sem erros de imutabilidade
  UNIQUE(customer_id, task_type, task_date)
);

-- MIGRATION: Adicionar colunas caso já existam em rfv_tasks
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rfv_tasks' AND COLUMN_NAME='revenue_generated') THEN
    ALTER TABLE public.rfv_tasks ADD COLUMN revenue_generated NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rfv_tasks' AND COLUMN_NAME='converted_order_id') THEN
    ALTER TABLE public.rfv_tasks ADD COLUMN converted_order_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rfv_tasks' AND COLUMN_NAME='conversion_timestamp') THEN
    ALTER TABLE public.rfv_tasks ADD COLUMN conversion_timestamp TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rfv_tasks' AND COLUMN_NAME='automation_eligible') THEN
    ALTER TABLE public.rfv_tasks ADD COLUMN automation_eligible BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rfv_tasks' AND COLUMN_NAME='automation_sent') THEN
    ALTER TABLE public.rfv_tasks ADD COLUMN automation_sent BOOLEAN DEFAULT false;
  END IF;
END $$;


CREATE INDEX IF NOT EXISTS idx_rfv_tasks_status ON public.rfv_tasks(status);
CREATE INDEX IF NOT EXISTS idx_rfv_tasks_priority ON public.rfv_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_rfv_tasks_date ON public.rfv_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_rfv_tasks_customer ON public.rfv_tasks(customer_id);

-- 3. TABELA: rfv_templates
-- Armazena templates de mensagens customizáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rfv_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  channel_context TEXT NOT NULL DEFAULT 'all', -- live_only, site_only, hybrid, all
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_type, channel_context)
);

-- Seed básico de templates (mesmas mensagens do script anterior)
INSERT INTO public.rfv_templates (task_type, channel_context, content)
VALUES 
  ('pos_compra', 'live_only', 'Oi {{name}} 💛 E aí, a peça da live ficou linda? Estou curiosa! 🥰'),
  ('pos_compra', 'hybrid', 'Oi {{name}} 💛 E a peça nova? Ficou maravilhosa? Tenho combinações perfeitas pra você tanto no site quanto na próxima live!'),
  ('pos_compra', 'site_only', 'Oi {{name}} 💛 Seu pedido chegou? Conta pra gente se amou! E se quiser, tenho combinações que ficam perfeitas com sua peça 😍'),
  ('vip', 'live_only', 'Oi {{name}} ✨ Antes da live começar, separei algo exclusivo pra você ver primeiro. Como nossa VIP merece!'),
  ('vip', 'hybrid', 'Oi {{name}} ✨ Você é uma das nossas clientes favoritas! Temos algo exclusivo separado pra você. Quer que eu mande por link ou mostra na live primeiro?'),
  ('vip', 'site_only', 'Oi {{name}} ✨ Acabamos de subir peças novas no site e lembrei de você. Acesso exclusivo antes de divulgar! 🤫'),
  ('preventivo', 'live_only', 'Oi {{name}} 💛 Sabe aquela sensação da live? Tem uma chegando com peças que combinam com você. Quer que eu te avise quando começar?'),
  ('preventivo', 'hybrid', 'Oi {{name}} 💛 Chegaram novidades tanto no site quanto nas lives! Onde você prefere ver primeiro?'),
  ('preventivo', 'site_only', 'Oi {{name}} 💛 Chegaram novidades no site que têm tudo a ver com seu estilo. Quer dar uma espiadinha?'),
  ('reativacao', 'live_only', 'Oi {{name}} 💛 Sentimos sua falta nas nossas lives! A próxima vai ter novidades de arrasar. Te espero lá?'),
  ('reativacao', 'hybrid', 'Oi {{name}} 💛 Notei que faz um tempinho! Temos novidades tanto no site quanto na próxima live. Te espero em qualquer um dos dois 🥰'),
  ('reativacao', 'site_only', 'Oi {{name}} 💛 Faz um tempinho que você não visita nosso site. Separei sugestões baseadas no seu perfil. Posso te enviar o link?'),
  ('migrar_canal', 'site_only', 'Oi {{name}} 💛 Sabia que nas nossas lives você encontra condições especiais e pode tirar dúvidas ao vivo? A próxima é imperdível!'),
  ('migrar_canal', 'live_only', 'Oi {{name}} 💛 Sabia que no nosso site tem peças exclusivas que não passam na live? Dá uma espiadinha quando puder!')
ON CONFLICT (task_type, channel_context) DO NOTHING;

-- RLS para templates
ALTER TABLE public.rfv_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view templates" ON public.rfv_templates;
CREATE POLICY "Authenticated can view templates" ON public.rfv_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can manage templates" ON public.rfv_templates;
CREATE POLICY "Authenticated can manage templates" ON public.rfv_templates FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS
ALTER TABLE public.customer_rfv_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfv_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view rfv metrics" ON public.customer_rfv_metrics;
CREATE POLICY "Authenticated can view rfv metrics" ON public.customer_rfv_metrics
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Service can manage rfv metrics" ON public.customer_rfv_metrics;
CREATE POLICY "Service can manage rfv metrics" ON public.customer_rfv_metrics
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Authenticated can view rfv tasks" ON public.rfv_tasks;
CREATE POLICY "Authenticated can view rfv tasks" ON public.rfv_tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can update rfv tasks" ON public.rfv_tasks;
CREATE POLICY "Authenticated can update rfv tasks" ON public.rfv_tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Service can manage rfv tasks" ON public.rfv_tasks;
CREATE POLICY "Service can manage rfv tasks" ON public.rfv_tasks
  FOR ALL USING (true);


-- ============================================================
-- 3. FUNÇÃO: recalculate_rfv_metrics()
-- Recalcula todas as métricas RFV para todos os clientes
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_rfv_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_customers INT := 0;
  v_start TIMESTAMPTZ := clock_timestamp();
BEGIN

  -- CTE principal: agregar dados por cliente
  WITH paid_orders AS (
    SELECT
      o.customer_id,
      o.id AS order_id,
      o.total,
      COALESCE(o.paid_at, o.created_at) AS purchase_date,
      CASE WHEN o.live_event_id IS NOT NULL THEN 'live' ELSE 'site' END AS channel
    FROM orders o
    WHERE o.status = 'pago'
      AND o.customer_id IS NOT NULL
      AND o.total > 0
  ),

  -- Métricas por cliente
  customer_stats AS (
    SELECT
      po.customer_id,
      -- Global
      EXTRACT(DAY FROM (now() - MAX(po.purchase_date)))::INT AS recency_days,
      COUNT(*)::INT AS frequency,
      SUM(po.total) AS monetary_value,
      AVG(po.total) AS avg_ticket,
      MIN(po.purchase_date) AS first_purchase_at,
      MAX(po.purchase_date) AS last_purchase_at,

      -- Por canal
      COUNT(*) FILTER (WHERE po.channel = 'live')::INT AS live_order_count,
      COUNT(*) FILTER (WHERE po.channel = 'site')::INT AS site_order_count,
      COALESCE(SUM(po.total) FILTER (WHERE po.channel = 'live'), 0) AS live_total,
      COALESCE(SUM(po.total) FILTER (WHERE po.channel = 'site'), 0) AS site_total,
      CASE WHEN COUNT(*) FILTER (WHERE po.channel = 'live') > 0
           THEN AVG(po.total) FILTER (WHERE po.channel = 'live') ELSE 0 END AS live_avg_ticket,
      CASE WHEN COUNT(*) FILTER (WHERE po.channel = 'site') > 0
           THEN AVG(po.total) FILTER (WHERE po.channel = 'site') ELSE 0 END AS site_avg_ticket,
      MAX(po.purchase_date) FILTER (WHERE po.channel = 'live') AS last_live_purchase_at,
      MAX(po.purchase_date) FILTER (WHERE po.channel = 'site') AS last_site_purchase_at
    FROM paid_orders po
    GROUP BY po.customer_id
  ),

  -- Ciclo entre compras (para clientes com 2+ compras)
  purchase_gaps AS (
    SELECT
      po.customer_id,
      EXTRACT(DAY FROM (
        po.purchase_date - LAG(po.purchase_date) OVER (PARTITION BY po.customer_id ORDER BY po.purchase_date)
      )) AS gap_days
    FROM paid_orders po
  ),

  cycle_stats AS (
    SELECT
      customer_id,
      AVG(gap_days)::NUMERIC(8,1) AS avg_cycle_days,
      COALESCE(STDDEV(gap_days), 0)::NUMERIC(8,1) AS cycle_stddev
    FROM purchase_gaps
    WHERE gap_days IS NOT NULL AND gap_days > 0
    GROUP BY customer_id
  ),

  -- Juntar tudo
  combined AS (
    SELECT
      cs.*,
      cy.avg_cycle_days,
      cy.cycle_stddev,
      -- Canal de compra
      CASE
        WHEN cs.live_order_count > 0 AND cs.site_order_count > 0 THEN 'hybrid'
        WHEN cs.live_order_count > 0 THEN 'live_only'
        ELSE 'site_only'
      END AS purchase_channel,
      -- Canal preferido (maior gasto)
      CASE
        WHEN cs.live_total > cs.site_total THEN 'live'
        WHEN cs.site_total > cs.live_total THEN 'site'
        ELSE 'site'
      END AS preferred_channel
    FROM customer_stats cs
    LEFT JOIN cycle_stats cy ON cy.customer_id = cs.customer_id
  ),

  -- Scores RFV usando quintis
  scored AS (
    SELECT
      c.*,
      -- R: menor recência = melhor (score 5)
      NTILE(5) OVER (ORDER BY c.recency_days DESC) AS r_score,
      -- F: maior frequência = melhor (score 5)
      NTILE(5) OVER (ORDER BY c.frequency ASC) AS f_score,
      -- V: maior valor = melhor (score 5)
      NTILE(5) OVER (ORDER BY c.monetary_value ASC) AS v_score
    FROM combined c
  ),

  -- Segmentação final
  segmented AS (
    SELECT
      s.*,
      -- Segmento RFV
      CASE
        WHEN s.r_score >= 4 AND s.f_score >= 4 AND s.v_score >= 4 THEN 'campeao'
        WHEN s.r_score >= 4 AND s.f_score >= 4 THEN 'fiel'
        WHEN s.r_score >= 4 AND s.f_score <= 2 THEN 'promissor'
        WHEN s.r_score = 3 AND s.f_score >= 3 THEN 'atencao'
        WHEN s.r_score IN (2,3) AND s.f_score <= 3 THEN 'hibernando'
        WHEN s.r_score = 1 THEN 'risco'
        ELSE 'novo'
      END AS rfv_segment,

      -- Risco de churn
      CASE
        WHEN s.avg_cycle_days IS NOT NULL AND s.recency_days > s.avg_cycle_days * 2 THEN 'critico'
        WHEN s.avg_cycle_days IS NOT NULL AND s.recency_days > s.avg_cycle_days * 1.5 THEN 'alto'
        WHEN s.avg_cycle_days IS NOT NULL AND s.recency_days > s.avg_cycle_days THEN 'medio'
        WHEN s.recency_days > 120 THEN 'alto'
        WHEN s.recency_days > 60 THEN 'medio'
        ELSE 'baixo'
      END AS churn_risk,

      -- Probabilidade de recompra (decaimento exponencial simples)
      CASE
        WHEN s.avg_cycle_days IS NOT NULL AND s.avg_cycle_days > 0 THEN
          LEAST(1.0, GREATEST(0.0,
            ROUND(EXP(-0.693 * s.recency_days / s.avg_cycle_days)::NUMERIC, 2)
          ))
        WHEN s.frequency = 1 AND s.recency_days <= 30 THEN 0.50
        WHEN s.frequency = 1 AND s.recency_days <= 60 THEN 0.30
        WHEN s.frequency = 1 AND s.recency_days <= 90 THEN 0.15
        ELSE 0.05
      END AS repurchase_probability,

      -- Janela ideal de contato
      CASE
        WHEN s.avg_cycle_days IS NOT NULL THEN
          (s.last_purchase_at + (s.avg_cycle_days * 0.7 * INTERVAL '1 day'))::DATE
        ELSE
          (s.last_purchase_at + INTERVAL '20 days')::DATE
      END AS ideal_contact_start,

      CASE
        WHEN s.avg_cycle_days IS NOT NULL THEN
          (s.last_purchase_at + (s.avg_cycle_days * 1.0 * INTERVAL '1 day'))::DATE
        ELSE
          (s.last_purchase_at + INTERVAL '40 days')::DATE
      END AS ideal_contact_end

    FROM scored s
  )

  -- UPSERT final
  INSERT INTO customer_rfv_metrics (
    customer_id, recency_days, frequency, monetary_value, avg_ticket,
    avg_cycle_days, cycle_stddev, repurchase_probability,
    individual_cycle_avg_days, individual_cycle_std_dev, cycle_deviation_percent, 
    repurchase_probability_score,
    r_score, f_score, v_score, rfv_segment, churn_risk,
    purchase_channel, live_order_count, site_order_count,
    live_total, site_total, live_avg_ticket, site_avg_ticket,
    last_live_purchase_at, last_site_purchase_at, preferred_channel,
    ideal_contact_start, ideal_contact_end,
    last_purchase_at, first_purchase_at, calculated_at
  )
  SELECT
    seg.customer_id, seg.recency_days, seg.frequency, seg.monetary_value, seg.avg_ticket,
    seg.avg_cycle_days, seg.cycle_stddev, seg.repurchase_probability,
    seg.avg_cycle_days, seg.cycle_stddev, -- Usando as mesmas métricas calculadas mas em campos específicos
    CASE 
      WHEN seg.avg_cycle_days > 0 THEN (seg.recency_days::NUMERIC / seg.avg_cycle_days)
      ELSE 0 
    END AS cycle_deviation_percent,
    -- Heurística de Score (0-100)
    (
      -- Proximidade do ciclo (até 40 pontos)
      CASE 
        WHEN seg.avg_cycle_days > 0 THEN 
          LEAST(40, ( (seg.recency_days::NUMERIC / seg.avg_cycle_days) * 40 )::INT)
        ELSE 0 
      END +
      -- Frequência (até 30 pontos)
      LEAST(30, (seg.frequency * 5)) +
      -- Segmento VIP (20 pontos)
      CASE WHEN seg.rfv_segment = 'campeao' THEN 20 WHEN seg.rfv_segment = 'fiel' THEN 10 ELSE 0 END +
      -- Recência recente (10 pontos)
      CASE WHEN seg.recency_days <= 30 THEN 10 ELSE 0 END
    ) AS repurchase_probability_score,
    seg.r_score, seg.f_score, seg.v_score, seg.rfv_segment, seg.churn_risk,
    seg.purchase_channel, seg.live_order_count, seg.site_order_count,
    seg.live_total, seg.site_total, seg.live_avg_ticket, seg.site_avg_ticket,
    seg.last_live_purchase_at, seg.last_site_purchase_at, seg.preferred_channel,
    seg.ideal_contact_start, seg.ideal_contact_end,
    seg.last_purchase_at, seg.first_purchase_at, now()
  FROM segmented seg
  ON CONFLICT (customer_id) DO UPDATE SET
    recency_days = EXCLUDED.recency_days,
    frequency = EXCLUDED.frequency,
    monetary_value = EXCLUDED.monetary_value,
    avg_ticket = EXCLUDED.avg_ticket,
    avg_cycle_days = EXCLUDED.avg_cycle_days,
    cycle_stddev = EXCLUDED.cycle_stddev,
    repurchase_probability = EXCLUDED.repurchase_probability,
    individual_cycle_avg_days = EXCLUDED.individual_cycle_avg_days,
    individual_cycle_std_dev = EXCLUDED.individual_cycle_std_dev,
    cycle_deviation_percent = EXCLUDED.cycle_deviation_percent,
    repurchase_probability_score = EXCLUDED.repurchase_probability_score,
    r_score = EXCLUDED.r_score,
    f_score = EXCLUDED.f_score,
    v_score = EXCLUDED.v_score,
    rfv_segment = EXCLUDED.rfv_segment,
    churn_risk = EXCLUDED.churn_risk,
    purchase_channel = EXCLUDED.purchase_channel,
    live_order_count = EXCLUDED.live_order_count,
    site_order_count = EXCLUDED.site_order_count,
    live_total = EXCLUDED.live_total,
    site_total = EXCLUDED.site_total,
    live_avg_ticket = EXCLUDED.live_avg_ticket,
    site_avg_ticket = EXCLUDED.site_avg_ticket,
    last_live_purchase_at = EXCLUDED.last_live_purchase_at,
    last_site_purchase_at = EXCLUDED.last_site_purchase_at,
    preferred_channel = EXCLUDED.preferred_channel,
    ideal_contact_start = EXCLUDED.ideal_contact_start,
    ideal_contact_end = EXCLUDED.ideal_contact_end,
    last_purchase_at = EXCLUDED.last_purchase_at,
    first_purchase_at = EXCLUDED.first_purchase_at,
    calculated_at = now();

  GET DIAGNOSTICS v_total_customers = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'customers_calculated', v_total_customers,
    'duration_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start))::INT
  );
END;
$$;


-- ============================================================
-- 4. FUNÇÃO: generate_rfv_tasks()
-- Gera tarefas acionáveis baseadas nas métricas RFV
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_rfv_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tasks_created INT := 0;
  v_today DATE := CURRENT_DATE;
  v_customer RECORD;
  v_msg TEXT;
  v_template RECORD;
  v_name TEXT;
  v_critical_count INT := 0;
  v_max_critical INT := 20;
BEGIN

  FOR v_customer IN
    SELECT
      m.*,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM customer_rfv_metrics m
    JOIN customers c ON c.id = m.customer_id
    WHERE m.frequency > 0
    ORDER BY
      m.repurchase_probability_score DESC,
      m.monetary_value DESC
  LOOP
    v_name := COALESCE(SPLIT_PART(v_customer.customer_name, ' ', 1), 'cliente');

    -- Tentar encontrar template customizado
    -- Ordem de busca: canal específico -> canal 'all' -> default hardcoded
    
    -- ===== REGRAS DE GERAÇÃO =====
    
    -- Função interna para resolver template
    -- (Como PLpgSQL não tem sub-functions limpas, fazemos inline ou buscamos antes)

    -- 1. PÓS-COMPRA
    IF v_customer.recency_days <= 7 THEN
      SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'pos_compra' AND channel_context = v_customer.purchase_channel;
      IF NOT FOUND THEN SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'pos_compra' AND channel_context = 'all'; END IF;
      IF NOT FOUND THEN v_msg := 'Oi {{name}} 💛 Seu pedido chegou? Conta pra gente se amou!'; END IF;
      
      v_msg := REPLACE(v_msg, '{{name}}', v_name);

      BEGIN
        INSERT INTO rfv_tasks (customer_id, task_type, priority, reason, suggested_message, objective, channel_context, estimated_impact, expires_at, automation_eligible)
        VALUES (
          v_customer.customer_id, 'pos_compra', 'oportunidade',
          'Comprou há ' || v_customer.recency_days || ' dias – momento ideal para pós-venda',
          v_msg, 'upsell', v_customer.purchase_channel,
          v_customer.avg_ticket,
          v_today + INTERVAL '7 days',
          (v_customer.repurchase_probability_score >= 80)
        );
        v_tasks_created := v_tasks_created + 1;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END IF;

    -- 2. VIP
    IF v_customer.rfv_segment = 'campeao' AND v_critical_count < v_max_critical THEN
      SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'vip' AND channel_context = v_customer.purchase_channel;
      IF NOT FOUND THEN SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'vip' AND channel_context = 'all'; END IF;
      IF NOT FOUND THEN v_msg := 'Oi {{name}} ✨ Novidades exclusivas para você!'; END IF;
      v_msg := REPLACE(v_msg, '{{name}}', v_name);

      BEGIN
        INSERT INTO rfv_tasks (customer_id, task_type, priority, reason, suggested_message, objective, channel_context, estimated_impact, expires_at, automation_eligible)
        VALUES (
          v_customer.customer_id, 'vip', 'critico',
          'Campeão (R' || v_customer.r_score || ' F' || v_customer.f_score || ' V' || v_customer.v_score || ') – atendimento VIP',
          v_msg, 'manter', v_customer.purchase_channel,
          v_customer.avg_ticket * 1.5,
          v_today + INTERVAL '2 days',
          true -- VIPs sempre qualificados para automação
        );
        v_tasks_created := v_tasks_created + 1;
        v_critical_count := v_critical_count + 1;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END IF;

    -- 3. PREVENTIVO
    IF v_customer.avg_cycle_days IS NOT NULL
       AND v_customer.recency_days >= (v_customer.avg_cycle_days * 0.8)::INT
       AND v_customer.recency_days < v_customer.avg_cycle_days::INT
    THEN
      SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'preventivo' AND channel_context = v_customer.purchase_channel;
      IF NOT FOUND THEN SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'preventivo' AND channel_context = 'all'; END IF;
      IF NOT FOUND THEN v_msg := 'Oi {{name}} 💛 Chegaram novidades que você vai amar!'; END IF;
      v_msg := REPLACE(v_msg, '{{name}}', v_name);

      BEGIN
        INSERT INTO rfv_tasks (customer_id, task_type, priority, reason, suggested_message, objective, channel_context, estimated_impact, expires_at)
        VALUES (
          v_customer.customer_id, 'preventivo', 'importante',
          'Cliente a ' || ROUND(v_customer.recency_days::NUMERIC / v_customer.avg_cycle_days * 100) || '% do ciclo de recompra',
          v_msg, 'manter', v_customer.purchase_channel,
          v_customer.avg_ticket,
          v_today + INTERVAL '2 days'
        );
        v_tasks_created := v_tasks_created + 1;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END IF;

    -- 4. REATIVAÇÃO
    IF (v_customer.avg_cycle_days IS NOT NULL AND v_customer.recency_days >= v_customer.avg_cycle_days::INT)
       OR (v_customer.avg_cycle_days IS NULL AND v_customer.recency_days > 60)
    THEN
      IF v_critical_count < v_max_critical THEN
        SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'reativacao' AND channel_context = v_customer.purchase_channel;
        IF NOT FOUND THEN SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'reativacao' AND channel_context = 'all'; END IF;
        IF NOT FOUND THEN v_msg := 'Oi {{name}} 💛 Sentimos sua falta!'; END IF;
        v_msg := REPLACE(v_msg, '{{name}}', v_name);

        BEGIN
          INSERT INTO rfv_tasks (customer_id, task_type, priority, reason, suggested_message, objective, channel_context, estimated_impact, expires_at)
          VALUES (
            v_customer.customer_id, 'reativacao', 
            CASE WHEN v_customer.recency_days > 120 THEN 'critico' ELSE 'importante' END,
            CASE WHEN v_customer.avg_cycle_days IS NOT NULL THEN 'Ciclo ultrapassado' ELSE 'Sumido há ' || v_customer.recency_days || ' dias' END,
            v_msg, 'reativar', v_customer.purchase_channel,
            v_customer.avg_ticket,
            v_today + INTERVAL '2 days'
          );
          v_tasks_created := v_tasks_created + 1;
          v_critical_count := v_critical_count + 1;
        EXCEPTION WHEN unique_violation THEN NULL;
        END;
      END IF;
    END IF;

    -- 5. MIGRAR CANAL
    IF v_customer.frequency >= 3 THEN
      IF (v_customer.purchase_channel = 'site_only' OR v_customer.purchase_channel = 'live_only') THEN
         -- Busca template específico de migração
         SELECT content INTO v_msg FROM rfv_templates WHERE task_type = 'migrar_canal' AND channel_context = v_customer.purchase_channel;
         IF FOUND THEN
           v_msg := REPLACE(v_msg, '{{name}}', v_name);
           BEGIN
             INSERT INTO rfv_tasks (customer_id, task_type, priority, reason, suggested_message, objective, channel_context, estimated_impact, expires_at)
             VALUES (
               v_customer.customer_id, 'migrar_canal', 'oportunidade',
               'Fiel no(a) ' || v_customer.purchase_channel || ' – oportunidade de cross-channel',
               v_msg, 'migrar', v_customer.purchase_channel,
               v_customer.avg_ticket * 0.5,
               v_today + INTERVAL '7 days'
             );
             v_tasks_created := v_tasks_created + 1;
           EXCEPTION WHEN unique_violation THEN NULL;
           END;
         END IF;
      END IF;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'tasks_created', v_tasks_created,
    'critical_tasks', v_critical_count,
    'date', v_today
  );
END;
$$;



-- ============================================================
-- 5. FUNÇÃO DE CONVENIÊNCIA: run_rfv_copilot()
-- Executa ambas as funções em sequência
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_rfv_copilot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics_result jsonb;
  v_tasks_result jsonb;
BEGIN
  v_metrics_result := recalculate_rfv_metrics();
  v_tasks_result := generate_rfv_tasks();

  RETURN jsonb_build_object(
    'metrics', v_metrics_result,
    'tasks', v_tasks_result,
    'executed_at', now()
  );
END;
$$;

-- 6. FUNÇÃO: attribute_rfv_revenue()
-- Vincula pedidos pagos a tarefas enviadas nos últimos 7 dias
-- ============================================================
CREATE OR REPLACE FUNCTION public.attribute_rfv_revenue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_revenue NUMERIC(12,2) := 0;
BEGIN
  -- Tenta achar tarefas que foram 'enviadas' para clientes que acabaram de pagar um pedido
  -- Regra: Pedido pago nos últimos 7 dias após o envio da tarefa
  WITH conversion_matching AS (
    SELECT 
      t.id as task_id,
      o.id as order_id,
      o.total as order_total,
      o.paid_at as order_paid_at
    FROM rfv_tasks t
    JOIN orders o ON o.customer_id = t.customer_id
    WHERE t.status = 'enviado'
      AND o.status = 'pago'
      AND o.paid_at >= t.executed_at 
      AND o.paid_at <= t.executed_at + INTERVAL '7 days'
      AND t.converted_order_id IS NULL -- Ainda não atribuído
  )
  UPDATE rfv_tasks t
  SET 
    status = 'converteu',
    converted_order_id = cm.order_id,
    revenue_generated = cm.order_total,
    conversion_timestamp = cm.order_paid_at
  FROM conversion_matching cm
  WHERE t.id = cm.task_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  SELECT SUM(revenue_generated) INTO v_revenue FROM rfv_tasks WHERE status = 'converteu';

  RETURN jsonb_build_object(
    'tasks_converted', v_count,
    'total_attributed_revenue', COALESCE(v_revenue, 0)
  );
END;
$$;
