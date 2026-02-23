-- RFV Copilot V2 stabilization
-- This migration keeps legacy RFV tables compatible with current frontend
-- and introduces daily snapshots + deterministic rule engine.

-- ---------------------------------------------------------------------------
-- 1) Ensure legacy RFV tables exist (idempotent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_rfv_metrics (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  recency_days integer NOT NULL DEFAULT 0,
  frequency integer NOT NULL DEFAULT 0,
  monetary_value numeric(12,2) NOT NULL DEFAULT 0,
  avg_ticket numeric(12,2) NOT NULL DEFAULT 0,
  avg_cycle_days numeric(10,2),
  cycle_stddev numeric(10,2),
  repurchase_probability numeric(6,4) DEFAULT 0,
  r_score integer DEFAULT 1,
  f_score integer DEFAULT 1,
  v_score integer DEFAULT 1,
  rfv_segment text DEFAULT 'novo',
  churn_risk text DEFAULT 'baixo',
  purchase_channel text DEFAULT 'site_only',
  live_order_count integer DEFAULT 0,
  site_order_count integer DEFAULT 0,
  live_total numeric(12,2) DEFAULT 0,
  site_total numeric(12,2) DEFAULT 0,
  live_avg_ticket numeric(12,2) DEFAULT 0,
  site_avg_ticket numeric(12,2) DEFAULT 0,
  last_live_purchase_at timestamptz,
  last_site_purchase_at timestamptz,
  preferred_channel text DEFAULT 'site',
  ideal_contact_start date,
  ideal_contact_end date,
  last_purchase_at timestamptz,
  first_purchase_at timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  individual_cycle_avg_days numeric(10,2),
  individual_cycle_std_dev numeric(10,2),
  cycle_deviation_percent numeric(10,4),
  repurchase_probability_score integer DEFAULT 0
);

ALTER TABLE public.customer_rfv_metrics
  ADD COLUMN IF NOT EXISTS individual_cycle_avg_days numeric(10,2),
  ADD COLUMN IF NOT EXISTS individual_cycle_std_dev numeric(10,2),
  ADD COLUMN IF NOT EXISTS cycle_deviation_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS repurchase_probability_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_avg_ticket numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS site_avg_ticket numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_live_purchase_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_site_purchase_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_customer_rfv_metrics_segment ON public.customer_rfv_metrics(rfv_segment);
CREATE INDEX IF NOT EXISTS idx_customer_rfv_metrics_risk ON public.customer_rfv_metrics(churn_risk);
CREATE INDEX IF NOT EXISTS idx_customer_rfv_metrics_channel ON public.customer_rfv_metrics(purchase_channel);

CREATE TABLE IF NOT EXISTS public.rfv_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  task_date date NOT NULL DEFAULT current_date,
  priority text NOT NULL DEFAULT 'oportunidade',
  reason text NOT NULL,
  suggested_message text NOT NULL,
  objective text NOT NULL DEFAULT 'manter',
  channel_context text NOT NULL DEFAULT 'all',
  estimated_impact numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  executed_by text,
  expires_at timestamptz,
  revenue_generated numeric(12,2) DEFAULT 0,
  converted_order_id uuid,
  conversion_timestamp timestamptz,
  automation_eligible boolean DEFAULT false,
  automation_sent boolean DEFAULT false,
  UNIQUE (customer_id, task_type, task_date)
);

ALTER TABLE public.rfv_tasks
  ADD COLUMN IF NOT EXISTS task_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS revenue_generated numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_order_id uuid,
  ADD COLUMN IF NOT EXISTS conversion_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS automation_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_sent boolean DEFAULT false;

WITH dedupe AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY customer_id, task_type, task_date
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.rfv_tasks
)
DELETE FROM public.rfv_tasks t
USING dedupe d
WHERE t.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfv_tasks_customer_type_day_uniq
  ON public.rfv_tasks(customer_id, task_type, task_date);

CREATE INDEX IF NOT EXISTS idx_rfv_tasks_status ON public.rfv_tasks(status);
CREATE INDEX IF NOT EXISTS idx_rfv_tasks_priority ON public.rfv_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_rfv_tasks_customer ON public.rfv_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_rfv_tasks_date ON public.rfv_tasks(task_date);

CREATE TABLE IF NOT EXISTS public.rfv_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  channel_context text NOT NULL DEFAULT 'all',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_type, channel_context)
);

ALTER TABLE public.rfv_templates
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

WITH dedupe_templates AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY task_type, channel_context
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.rfv_templates
)
DELETE FROM public.rfv_templates t
USING dedupe_templates d
WHERE t.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfv_templates_type_channel_uniq
  ON public.rfv_templates(task_type, channel_context);

-- ---------------------------------------------------------------------------
-- 2) New daily snapshot table (RFV history)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rfv_daily (
  day date NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  recency_days integer NOT NULL DEFAULT 0,
  frequency_12m integer NOT NULL DEFAULT 0,
  monetary_12m numeric(12,2) NOT NULL DEFAULT 0,
  ticket_avg_12m numeric(12,2) NOT NULL DEFAULT 0,
  cycle_mean_days numeric(10,2),
  cycle_std_days numeric(10,2),
  adherence_ratio numeric(10,4),
  r_score integer NOT NULL DEFAULT 1,
  f_score integer NOT NULL DEFAULT 1,
  v_score integer NOT NULL DEFAULT 1,
  segment_ak text NOT NULL DEFAULT 'E',
  churn_risk text NOT NULL DEFAULT 'low',
  buy_probability numeric(6,4) NOT NULL DEFAULT 0,
  score_recorrencia numeric(8,2) NOT NULL DEFAULT 0,
  purchase_channel text NOT NULL DEFAULT 'site_only',
  live_order_count integer NOT NULL DEFAULT 0,
  site_order_count integer NOT NULL DEFAULT 0,
  live_total numeric(12,2) NOT NULL DEFAULT 0,
  site_total numeric(12,2) NOT NULL DEFAULT 0,
  preferred_channel text NOT NULL DEFAULT 'site',
  last_order_at timestamptz,
  first_order_at timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_rfv_daily_customer_day ON public.rfv_daily(customer_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_rfv_daily_day ON public.rfv_daily(day DESC);
CREATE INDEX IF NOT EXISTS idx_rfv_daily_segment ON public.rfv_daily(segment_ak, day DESC);
CREATE INDEX IF NOT EXISTS idx_rfv_daily_risk ON public.rfv_daily(churn_risk, day DESC);

-- ---------------------------------------------------------------------------
-- 3) Default templates aligned to Copilot document
-- ---------------------------------------------------------------------------

INSERT INTO public.rfv_templates (task_type, channel_context, content)
VALUES
  ('pos_compra', 'site_only', 'Oi {{name}}. Aqui e da Le.Poa. Sua peca vestiu como voce imaginava? Posso te enviar 2 combinacoes que deixam o look ainda mais elegante?'),
  ('pos_compra', 'live_only', 'Oi {{name}}. A peca da live ficou como voce esperava? Se me disser onde vai usar, te envio 2 sugestoes perfeitas.'),
  ('pos_compra', 'all', 'Oi {{name}}. Sua peca vestiu como voce imaginava? Posso te enviar 2 sugestoes no seu estilo?'),
  ('preventivo', 'all', 'Oi {{name}}. Chegaram pecas novas no seu estilo. Quer que eu te envie 2 opcoes certeiras?'),
  ('reativacao', 'all', 'Oi {{name}}. Senti sua falta por aqui. Posso te mostrar 2 novidades que sao a sua cara?'),
  ('vip', 'all', 'Oi {{name}}. Recebemos algo especial hoje e lembrei de voce antes de divulgar. Prefere ver agora ou mais tarde?'),
  ('migrar_canal', 'site_only', 'Oi {{name}}. Posso te convidar para a proxima live? Vou separar 2 opcoes no seu estilo para voce ver primeiro.'),
  ('migrar_canal', 'live_only', 'Oi {{name}}. Separei 2 opcoes exclusivas no site que combinam com voce. Quer que eu te envie o link?')
ON CONFLICT (task_type, channel_context) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rfv_task_probability(p_task_type text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_task_type
    WHEN 'post_sale' THEN 0.30
    WHEN 'preventive' THEN 0.22
    WHEN 'reactivation' THEN 0.16
    WHEN 'vip' THEN 0.35
    WHEN 'channel_migration' THEN 0.12
    ELSE 0.10
  END;
$$;

CREATE OR REPLACE FUNCTION public.rfv_segment_weight(p_segment_ak text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_segment_ak
    WHEN 'A' THEN 1.50
    WHEN 'B' THEN 1.25
    WHEN 'C' THEN 1.00
    WHEN 'D' THEN 0.80
    ELSE 0.60
  END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_rfv_template(
  p_task_type text,
  p_channel_context text,
  p_customer_name text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_content text;
  v_name text;
BEGIN
  v_name := COALESCE(NULLIF(split_part(COALESCE(p_customer_name, ''), ' ', 1), ''), 'cliente');

  SELECT t.content
    INTO v_content
    FROM public.rfv_templates t
   WHERE t.task_type = p_task_type
     AND t.channel_context = p_channel_context
   LIMIT 1;

  IF v_content IS NULL THEN
    SELECT t.content
      INTO v_content
      FROM public.rfv_templates t
     WHERE t.task_type = p_task_type
       AND t.channel_context = 'all'
     LIMIT 1;
  END IF;

  IF v_content IS NULL THEN
    v_content := 'Oi {{name}}. Tenho novidades no seu estilo.';
  END IF;

  RETURN replace(v_content, '{{name}}', v_name);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) RFV metrics engine (daily snapshot + legacy compatibility table)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_rfv_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_customers integer := 0;
BEGIN
  WITH paid_orders AS (
    SELECT
      o.customer_id,
      COALESCE(o.paid_at, o.created_at) AS purchase_at,
      COALESCE(o.total, 0)::numeric(12,2) AS total,
      CASE
        WHEN COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL THEN 'live'
        ELSE 'site'
      END AS channel
    FROM public.orders o
    WHERE o.customer_id IS NOT NULL
      AND COALESCE(o.total, 0) > 0
      AND o.status IN ('pago', 'confirmado', 'etiqueta_gerada', 'enviado', 'entregue')
  ),
  paid_orders_12m AS (
    SELECT *
    FROM paid_orders
    WHERE purchase_at >= (v_today::timestamp - interval '12 months')
  ),
  agg_12m AS (
    SELECT
      p.customer_id,
      count(*)::int AS frequency_12m,
      sum(p.total)::numeric(12,2) AS monetary_12m,
      max(p.purchase_at) AS last_order_at,
      count(*) FILTER (WHERE p.channel = 'live')::int AS live_order_count,
      count(*) FILTER (WHERE p.channel = 'site')::int AS site_order_count,
      COALESCE(sum(p.total) FILTER (WHERE p.channel = 'live'), 0)::numeric(12,2) AS live_total,
      COALESCE(sum(p.total) FILTER (WHERE p.channel = 'site'), 0)::numeric(12,2) AS site_total
    FROM paid_orders_12m p
    GROUP BY p.customer_id
  ),
  lifetime AS (
    SELECT
      p.customer_id,
      count(*)::int AS lifetime_orders,
      min(p.purchase_at) AS first_order_at
    FROM paid_orders p
    GROUP BY p.customer_id
  ),
  gaps AS (
    SELECT
      p.customer_id,
      EXTRACT(EPOCH FROM (
        p.purchase_at - lag(p.purchase_at) OVER (PARTITION BY p.customer_id ORDER BY p.purchase_at)
      )) / 86400.0 AS gap_days
    FROM paid_orders p
  ),
  valid_gaps AS (
    SELECT g.customer_id, g.gap_days
    FROM gaps g
    WHERE g.gap_days IS NOT NULL
      AND g.gap_days >= 2
      AND g.gap_days <= 365
  ),
  cycle_customer AS (
    SELECT
      g.customer_id,
      avg(g.gap_days)::numeric(10,2) AS cycle_mean_days,
      COALESCE(stddev_pop(g.gap_days), 0)::numeric(10,2) AS cycle_std_days
    FROM valid_gaps g
    GROUP BY g.customer_id
  ),
  global_cycle AS (
    SELECT
      COALESCE(
        percentile_cont(0.5) WITHIN GROUP (ORDER BY g.gap_days),
        30.0
      )::numeric(10,2) AS global_cycle_days
    FROM valid_gaps g
    JOIN lifetime l ON l.customer_id = g.customer_id
    WHERE l.lifetime_orders >= 3
  ),
  base AS (
    SELECT
      a.customer_id,
      greatest(0, (v_today - (a.last_order_at::date)))::int AS recency_days,
      a.frequency_12m,
      a.monetary_12m,
      CASE WHEN a.frequency_12m > 0 THEN round(a.monetary_12m / a.frequency_12m, 2) ELSE 0 END AS ticket_avg_12m,
      CASE
        WHEN l.lifetime_orders >= 3 AND c.cycle_mean_days IS NOT NULL THEN c.cycle_mean_days
        ELSE gc.global_cycle_days
      END AS cycle_mean_days,
      COALESCE(c.cycle_std_days, 0)::numeric(10,2) AS cycle_std_days,
      a.live_order_count,
      a.site_order_count,
      a.live_total,
      a.site_total,
      CASE
        WHEN a.live_order_count > 0 AND a.site_order_count > 0 THEN 'hybrid'
        WHEN a.live_order_count > 0 THEN 'live_only'
        ELSE 'site_only'
      END AS purchase_channel,
      CASE
        WHEN a.live_total > a.site_total THEN 'live'
        WHEN a.site_total > a.live_total THEN 'site'
        ELSE 'site'
      END AS preferred_channel,
      a.last_order_at,
      l.first_order_at
    FROM agg_12m a
    JOIN lifetime l ON l.customer_id = a.customer_id
    LEFT JOIN cycle_customer c ON c.customer_id = a.customer_id
    CROSS JOIN global_cycle gc
  ),
  scored AS (
    SELECT
      b.*,
      ntile(5) OVER (ORDER BY b.recency_days DESC) AS r_score,
      ntile(5) OVER (ORDER BY b.frequency_12m ASC) AS f_score,
      ntile(5) OVER (ORDER BY b.monetary_12m ASC) AS v_score
    FROM base b
  ),
  final AS (
    SELECT
      s.*,
      CASE
        WHEN (s.r_score + s.f_score + s.v_score) >= 13 THEN 'A'
        WHEN (s.r_score + s.f_score + s.v_score) >= 10 THEN 'B'
        WHEN (s.r_score + s.f_score + s.v_score) >= 7 THEN 'C'
        WHEN (s.r_score + s.f_score + s.v_score) >= 5 THEN 'D'
        ELSE 'E'
      END AS segment_ak,
      CASE
        WHEN s.cycle_mean_days > 0 AND (s.recency_days::numeric / s.cycle_mean_days) >= 1.30 THEN 'high'
        WHEN s.cycle_mean_days > 0 AND (s.recency_days::numeric / s.cycle_mean_days) >= 1.00 THEN 'medium'
        ELSE 'low'
      END AS churn_risk,
      CASE
        WHEN s.cycle_mean_days > 0 AND (s.recency_days::numeric / s.cycle_mean_days) >= 1.30 THEN 0.15
        WHEN s.cycle_mean_days > 0 AND (s.recency_days::numeric / s.cycle_mean_days) >= 1.00 THEN 0.35
        WHEN s.cycle_mean_days > 0 AND (s.recency_days::numeric / s.cycle_mean_days) >= 0.70 THEN 0.55
        ELSE 0.75
      END::numeric(6,4) AS buy_probability,
      CASE
        WHEN s.cycle_mean_days > 0 THEN round((s.recency_days::numeric / s.cycle_mean_days)::numeric, 4)
        ELSE NULL
      END AS adherence_ratio,
      round((
        (
          (1.0 / (1.0 + (s.recency_days::numeric / 30.0))) * 0.35
          + LEAST(1.0, s.frequency_12m::numeric / 12.0) * 0.25
          + LEAST(1.0, s.ticket_avg_12m::numeric / 600.0) * 0.20
          + GREATEST(0.0, 1.0 - ABS(COALESCE((s.recency_days::numeric / NULLIF(s.cycle_mean_days, 0)), 1.0) - 0.9)) * 0.20
        ) * 100.0
      )::numeric, 2) AS score_recorrencia
    FROM scored s
  ),
  upsert_daily AS (
    INSERT INTO public.rfv_daily (
      day, customer_id, recency_days, frequency_12m, monetary_12m, ticket_avg_12m,
      cycle_mean_days, cycle_std_days, adherence_ratio, r_score, f_score, v_score,
      segment_ak, churn_risk, buy_probability, score_recorrencia,
      purchase_channel, live_order_count, site_order_count, live_total, site_total,
      preferred_channel, last_order_at, first_order_at, calculated_at
    )
    SELECT
      v_today,
      f.customer_id,
      f.recency_days,
      f.frequency_12m,
      f.monetary_12m,
      f.ticket_avg_12m,
      f.cycle_mean_days,
      f.cycle_std_days,
      f.adherence_ratio,
      f.r_score,
      f.f_score,
      f.v_score,
      f.segment_ak,
      f.churn_risk,
      f.buy_probability,
      f.score_recorrencia,
      f.purchase_channel,
      f.live_order_count,
      f.site_order_count,
      f.live_total,
      f.site_total,
      f.preferred_channel,
      f.last_order_at,
      f.first_order_at,
      now()
    FROM final f
    ON CONFLICT (day, customer_id) DO UPDATE
    SET
      recency_days = EXCLUDED.recency_days,
      frequency_12m = EXCLUDED.frequency_12m,
      monetary_12m = EXCLUDED.monetary_12m,
      ticket_avg_12m = EXCLUDED.ticket_avg_12m,
      cycle_mean_days = EXCLUDED.cycle_mean_days,
      cycle_std_days = EXCLUDED.cycle_std_days,
      adherence_ratio = EXCLUDED.adherence_ratio,
      r_score = EXCLUDED.r_score,
      f_score = EXCLUDED.f_score,
      v_score = EXCLUDED.v_score,
      segment_ak = EXCLUDED.segment_ak,
      churn_risk = EXCLUDED.churn_risk,
      buy_probability = EXCLUDED.buy_probability,
      score_recorrencia = EXCLUDED.score_recorrencia,
      purchase_channel = EXCLUDED.purchase_channel,
      live_order_count = EXCLUDED.live_order_count,
      site_order_count = EXCLUDED.site_order_count,
      live_total = EXCLUDED.live_total,
      site_total = EXCLUDED.site_total,
      preferred_channel = EXCLUDED.preferred_channel,
      last_order_at = EXCLUDED.last_order_at,
      first_order_at = EXCLUDED.first_order_at,
      calculated_at = now()
    RETURNING customer_id
  )
  INSERT INTO public.customer_rfv_metrics (
    customer_id,
    recency_days,
    frequency,
    monetary_value,
    avg_ticket,
    avg_cycle_days,
    cycle_stddev,
    repurchase_probability,
    r_score,
    f_score,
    v_score,
    rfv_segment,
    churn_risk,
    purchase_channel,
    live_order_count,
    site_order_count,
    live_total,
    site_total,
    live_avg_ticket,
    site_avg_ticket,
    preferred_channel,
    ideal_contact_start,
    ideal_contact_end,
    last_purchase_at,
    first_purchase_at,
    calculated_at,
    individual_cycle_avg_days,
    individual_cycle_std_dev,
    cycle_deviation_percent,
    repurchase_probability_score
  )
  SELECT
    f.customer_id,
    f.recency_days,
    f.frequency_12m,
    f.monetary_12m,
    f.ticket_avg_12m,
    f.cycle_mean_days,
    f.cycle_std_days,
    f.buy_probability,
    f.r_score,
    f.f_score,
    f.v_score,
    CASE f.segment_ak
      WHEN 'A' THEN 'campeao'
      WHEN 'B' THEN 'fiel'
      WHEN 'C' THEN 'promissor'
      WHEN 'D' THEN 'atencao'
      ELSE 'risco'
    END AS rfv_segment,
    CASE f.churn_risk
      WHEN 'high' THEN 'alto'
      WHEN 'medium' THEN 'medio'
      ELSE 'baixo'
    END AS churn_risk,
    f.purchase_channel,
    f.live_order_count,
    f.site_order_count,
    f.live_total,
    f.site_total,
    CASE WHEN f.live_order_count > 0 THEN round(f.live_total / f.live_order_count, 2) ELSE 0 END AS live_avg_ticket,
    CASE WHEN f.site_order_count > 0 THEN round(f.site_total / f.site_order_count, 2) ELSE 0 END AS site_avg_ticket,
    f.preferred_channel,
    (f.last_order_at::date + (greatest(1, round(COALESCE(f.cycle_mean_days, 30) * 0.70))::text || ' days')::interval)::date AS ideal_contact_start,
    (f.last_order_at::date + (greatest(1, round(COALESCE(f.cycle_mean_days, 30) * 1.00))::text || ' days')::interval)::date AS ideal_contact_end,
    f.last_order_at,
    f.first_order_at,
    now(),
    f.cycle_mean_days,
    f.cycle_std_days,
    f.adherence_ratio,
    least(100, greatest(0, round(f.score_recorrencia)))::int
  FROM final f
  ON CONFLICT (customer_id) DO UPDATE
  SET
    recency_days = EXCLUDED.recency_days,
    frequency = EXCLUDED.frequency,
    monetary_value = EXCLUDED.monetary_value,
    avg_ticket = EXCLUDED.avg_ticket,
    avg_cycle_days = EXCLUDED.avg_cycle_days,
    cycle_stddev = EXCLUDED.cycle_stddev,
    repurchase_probability = EXCLUDED.repurchase_probability,
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
    preferred_channel = EXCLUDED.preferred_channel,
    ideal_contact_start = EXCLUDED.ideal_contact_start,
    ideal_contact_end = EXCLUDED.ideal_contact_end,
    last_purchase_at = EXCLUDED.last_purchase_at,
    first_purchase_at = EXCLUDED.first_purchase_at,
    calculated_at = now(),
    individual_cycle_avg_days = EXCLUDED.individual_cycle_avg_days,
    individual_cycle_std_dev = EXCLUDED.individual_cycle_std_dev,
    cycle_deviation_percent = EXCLUDED.cycle_deviation_percent,
    repurchase_probability_score = EXCLUDED.repurchase_probability_score;

  GET DIAGNOSTICS v_customers = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'day', v_today,
    'customers_calculated', v_customers
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Task generation engine (idempotent, rule-based)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_rfv_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_row record;
  v_created integer := 0;
  v_row_count integer := 0;
  v_message text;
  v_template_channel text;
  v_impact numeric(12,2);
BEGIN
  FOR v_row IN
    WITH today_metrics AS (
      SELECT
        d.*,
        c.name AS customer_name
      FROM public.rfv_daily d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.day = v_today
    ),
    candidates AS (
      -- Rule 1: post-sale (D+3)
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'post_sale'::text AS task_kind,
        'pos_compra'::text AS task_type,
        'oportunidade'::text AS priority,
        'upsell'::text AS objective,
        'Pos-venda D+3: confirmar experiencia e abrir oportunidade de recompra'::text AS reason
      FROM today_metrics tm
      WHERE tm.recency_days = 3

      UNION ALL

      -- Rule 4: VIP
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'vip',
        'vip',
        'critico',
        'manter',
        'Cliente VIP (segmento A): atendimento prioritario e comunicacao exclusiva'
      FROM today_metrics tm
      WHERE tm.segment_ak = 'A'

      UNION ALL

      -- Rule 2: preventive
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'preventive',
        'preventivo',
        'importante',
        'manter',
        'Cliente em janela preventiva (70% a 100% do ciclo): contato antes da ruptura de recorrencia'
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.adherence_ratio >= 0.70
        AND tm.adherence_ratio < 1.00

      UNION ALL

      -- Rule 3: reactivation
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'reactivation',
        'reativacao',
        'critico',
        'reativar',
        CASE
          WHEN tm.adherence_ratio >= 1.30
            THEN 'Cliente acima de 130% do ciclo: reativacao critica maxima'
          ELSE 'Cliente acima do ciclo: reativacao critica'
        END
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.adherence_ratio >= 1.00

      UNION ALL

      -- Rule 5a: migration site -> live
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'channel_migration',
        'migrar_canal',
        'oportunidade',
        'migrar',
        'Cliente compra apenas no site: migrar para live'
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.purchase_channel = 'site_only'
        AND tm.frequency_12m >= 3
        AND tm.recency_days >= 7
        AND tm.recency_days <= 90

      UNION ALL

      -- Rule 5b: migration live -> site
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'channel_migration',
        'migrar_canal',
        'oportunidade',
        'migrar',
        'Cliente compra apenas na live: migrar para site'
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.purchase_channel = 'live_only'
        AND tm.frequency_12m >= 3
        AND tm.recency_days >= 7
        AND tm.recency_days <= 90
    )
    SELECT *
    FROM candidates
  LOOP
    v_template_channel := CASE
      WHEN v_row.task_type = 'pos_compra' AND v_row.purchase_channel = 'live_only' THEN 'live_only'
      WHEN v_row.task_type = 'pos_compra' AND v_row.purchase_channel = 'site_only' THEN 'site_only'
      WHEN v_row.task_type = 'migrar_canal' THEN v_row.purchase_channel
      ELSE 'all'
    END;

    v_message := public.resolve_rfv_template(v_row.task_type, v_template_channel, v_row.customer_name);

    v_impact := round(
      COALESCE(v_row.ticket_avg_12m, 0)
      * public.rfv_task_probability(v_row.task_kind)
      * public.rfv_segment_weight(v_row.segment_ak),
      2
    );

    INSERT INTO public.rfv_tasks (
      customer_id,
      task_type,
      task_date,
      priority,
      reason,
      suggested_message,
      objective,
      channel_context,
      estimated_impact,
      status,
      expires_at,
      automation_eligible
    )
    VALUES (
      v_row.customer_id,
      v_row.task_type,
      v_today,
      v_row.priority,
      v_row.reason,
      v_message,
      v_row.objective,
      v_template_channel,
      v_impact,
      'pendente',
      CASE WHEN v_row.priority = 'critico' THEN (now() + interval '2 days') ELSE (now() + interval '7 days') END,
      (v_row.task_kind IN ('vip', 'post_sale'))
    )
    ON CONFLICT (customer_id, task_type, task_date) DO UPDATE
    SET
      priority = EXCLUDED.priority,
      reason = EXCLUDED.reason,
      suggested_message = EXCLUDED.suggested_message,
      objective = EXCLUDED.objective,
      channel_context = EXCLUDED.channel_context,
      estimated_impact = EXCLUDED.estimated_impact,
      expires_at = EXCLUDED.expires_at,
      automation_eligible = EXCLUDED.automation_eligible
    WHERE public.rfv_tasks.status = 'pendente';

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_created := v_created + v_row_count;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'day', v_today,
    'tasks_created_or_refreshed', v_created
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Orchestrator + revenue attribution
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_rfv_copilot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
  v_tasks jsonb;
BEGIN
  v_metrics := public.recalculate_rfv_metrics();
  v_tasks := public.generate_rfv_tasks();

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'tasks', v_tasks,
    'executed_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.attribute_rfv_revenue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_total numeric(12,2) := 0;
BEGIN
  WITH candidates AS (
    SELECT
      t.id AS task_id,
      o.id AS order_id,
      COALESCE(o.total, 0)::numeric(12,2) AS order_total,
      COALESCE(o.paid_at, o.created_at) AS paid_at,
      row_number() OVER (
        PARTITION BY t.id
        ORDER BY COALESCE(o.paid_at, o.created_at) ASC
      ) AS rn
    FROM public.rfv_tasks t
    JOIN public.orders o ON o.customer_id = t.customer_id
    WHERE t.converted_order_id IS NULL
      AND t.status IN ('enviado', 'respondeu', 'converteu')
      AND o.status IN ('pago', 'confirmado', 'etiqueta_gerada', 'enviado', 'entregue')
      AND COALESCE(o.paid_at, o.created_at) >= COALESCE(t.executed_at, t.created_at)
      AND COALESCE(o.paid_at, o.created_at) <= COALESCE(t.executed_at, t.created_at) + interval '7 days'
  ),
  picked AS (
    SELECT *
    FROM candidates
    WHERE rn = 1
  )
  UPDATE public.rfv_tasks t
     SET status = 'converteu',
         converted_order_id = p.order_id,
         revenue_generated = p.order_total,
         conversion_timestamp = p.paid_at
    FROM picked p
   WHERE t.id = p.task_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT COALESCE(sum(t.revenue_generated), 0)::numeric(12,2)
    INTO v_total
    FROM public.rfv_tasks t
   WHERE t.status = 'converteu';

  RETURN jsonb_build_object(
    'success', true,
    'tasks_converted', v_count,
    'total_attributed_revenue', v_total
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Compatibility views with requested naming
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.copilot_tasks;
CREATE VIEW public.copilot_tasks
WITH (security_invoker = on)
AS
SELECT
  t.id,
  t.task_date AS day,
  t.customer_id,
  CASE t.task_type
    WHEN 'pos_compra' THEN 'post_sale'
    WHEN 'preventivo' THEN 'preventive'
    WHEN 'reativacao' THEN 'reactivation'
    WHEN 'migrar_canal' THEN 'channel_migration'
    ELSE t.task_type
  END AS task_type,
  CASE t.priority
    WHEN 'critico' THEN 'critical'
    WHEN 'importante' THEN 'high'
    ELSE 'medium'
  END AS priority,
  t.reason,
  CASE
    WHEN t.task_type = 'pos_compra' AND t.channel_context = 'live_only' THEN 'post_sale.live'
    WHEN t.task_type = 'pos_compra' THEN 'post_sale.site'
    WHEN t.task_type = 'preventivo' THEN 'preventive.general'
    WHEN t.task_type = 'reativacao' THEN 'reactivation.general'
    WHEN t.task_type = 'vip' THEN 'vip.general'
    WHEN t.task_type = 'migrar_canal' AND t.channel_context = 'site_only' THEN 'channel_migration_site_to_live.general'
    WHEN t.task_type = 'migrar_canal' AND t.channel_context = 'live_only' THEN 'channel_migration_live_to_site.general'
    ELSE 'preventive.general'
  END AS suggested_template_key,
  t.suggested_message,
  t.estimated_impact AS impact_estimated,
  CASE t.status
    WHEN 'pendente' THEN 'todo'
    WHEN 'enviado' THEN 'sent'
    WHEN 'respondeu' THEN 'replied'
    WHEN 'converteu' THEN 'won'
    WHEN 'sem_resposta' THEN 'no_reply'
    ELSE 'skipped'
  END AS status,
  t.executed_by AS checked_by,
  t.executed_at AS checked_at,
  t.converted_order_id AS related_order_id,
  t.revenue_generated AS revenue_attributed,
  t.created_at
FROM public.rfv_tasks t;

DROP VIEW IF EXISTS public.message_templates;
CREATE VIEW public.message_templates
WITH (security_invoker = on)
AS
SELECT
  rt.id,
  CASE
    WHEN rt.task_type = 'pos_compra' AND rt.channel_context = 'live_only' THEN 'post_sale.live'
    WHEN rt.task_type = 'pos_compra' THEN 'post_sale.site'
    WHEN rt.task_type = 'preventivo' THEN 'preventive.general'
    WHEN rt.task_type = 'reativacao' THEN 'reactivation.general'
    WHEN rt.task_type = 'vip' THEN 'vip.general'
    WHEN rt.task_type = 'migrar_canal' AND rt.channel_context = 'site_only' THEN 'channel_migration_site_to_live.general'
    WHEN rt.task_type = 'migrar_canal' AND rt.channel_context = 'live_only' THEN 'channel_migration_live_to_site.general'
    ELSE rt.task_type || '.general'
  END AS key,
  initcap(replace(rt.task_type, '_', ' ')) AS title,
  CASE rt.channel_context
    WHEN 'site_only' THEN 'site'
    WHEN 'live_only' THEN 'live'
    WHEN 'hybrid' THEN 'hybrid'
    ELSE 'general'
  END AS channel_scope,
  rt.content AS body,
  true AS active,
  rt.updated_at
FROM public.rfv_templates rt;

GRANT SELECT ON public.rfv_daily TO authenticated;
GRANT SELECT ON public.copilot_tasks TO authenticated;
GRANT SELECT ON public.message_templates TO authenticated;
