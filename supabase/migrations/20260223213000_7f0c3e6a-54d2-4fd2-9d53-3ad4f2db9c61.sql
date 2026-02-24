-- RFV Copilot corrections:
-- 1) Fix recency scoring direction (recent customers must score higher).
-- 2) VIP cooldown (no daily VIP spam).
-- 3) One active task per customer per day via hierarchy.
-- 4) Deterministic post-sale window (D+3 with safe date window).
-- 5) Legacy skipped status normalization/mapping.
-- 6) Deterministic/auditable revenue attribution (first paid order in window).

-- Normalize legacy "skipped" statuses in storage.
UPDATE public.rfv_tasks
SET status = 'skipped'
WHERE status IN ('pulou', 'ignorado', 'skipado');

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
      ntile(5) OVER (ORDER BY b.recency_days ASC) AS r_rank,
      ntile(5) OVER (ORDER BY b.frequency_12m ASC) AS f_score,
      ntile(5) OVER (ORDER BY b.monetary_12m ASC) AS v_score
    FROM base b
  ),
  final AS (
    SELECT
      s.*,
      (6 - s.r_rank) AS r_score,
      CASE
        WHEN ((6 - s.r_rank) + s.f_score + s.v_score) >= 13 THEN 'A'
        WHEN ((6 - s.r_rank) + s.f_score + s.v_score) >= 10 THEN 'B'
        WHEN ((6 - s.r_rank) + s.f_score + s.v_score) >= 7 THEN 'C'
        WHEN ((6 - s.r_rank) + s.f_score + s.v_score) >= 5 THEN 'D'
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
  )
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
    calculated_at = now();

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
    d.customer_id,
    d.recency_days,
    d.frequency_12m,
    d.monetary_12m,
    d.ticket_avg_12m,
    d.cycle_mean_days,
    d.cycle_std_days,
    d.buy_probability,
    d.r_score,
    d.f_score,
    d.v_score,
    CASE d.segment_ak
      WHEN 'A' THEN 'campeao'
      WHEN 'B' THEN 'fiel'
      WHEN 'C' THEN 'promissor'
      WHEN 'D' THEN 'atencao'
      ELSE 'risco'
    END AS rfv_segment,
    CASE d.churn_risk
      WHEN 'high' THEN 'alto'
      WHEN 'medium' THEN 'medio'
      ELSE 'baixo'
    END AS churn_risk,
    d.purchase_channel,
    d.live_order_count,
    d.site_order_count,
    d.live_total,
    d.site_total,
    CASE WHEN d.live_order_count > 0 THEN round(d.live_total / d.live_order_count, 2) ELSE 0 END AS live_avg_ticket,
    CASE WHEN d.site_order_count > 0 THEN round(d.site_total / d.site_order_count, 2) ELSE 0 END AS site_avg_ticket,
    d.preferred_channel,
    (d.last_order_at::date + (greatest(1, round(COALESCE(d.cycle_mean_days, 30) * 0.70))::text || ' days')::interval)::date AS ideal_contact_start,
    (d.last_order_at::date + (greatest(1, round(COALESCE(d.cycle_mean_days, 30) * 1.00))::text || ' days')::interval)::date AS ideal_contact_end,
    d.last_order_at,
    d.first_order_at,
    now(),
    d.cycle_mean_days,
    d.cycle_std_days,
    d.adherence_ratio,
    least(100, greatest(0, round(d.score_recorrencia)))::int
  FROM public.rfv_daily d
  WHERE d.day = v_today
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

CREATE OR REPLACE FUNCTION public.generate_rfv_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_row record;
  v_affected integer := 0;
  v_row_count integer := 0;
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
    raw_candidates AS (
      -- reactivation (highest priority)
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'reativacao'::text AS task_type,
        'critico'::text AS priority,
        'reativar'::text AS objective,
        CASE
          WHEN tm.adherence_ratio >= 1.30 THEN 'Cliente acima de 130% do ciclo: reativacao critica maxima'
          ELSE 'Cliente acima do ciclo: reativacao critica'
        END AS reason,
        1 AS priority_rank
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.adherence_ratio >= 1.00

      UNION ALL

      -- vip (cooldown 14 days)
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'vip',
        'importante',
        'manter',
        'Cliente VIP (segmento A): atendimento prioritario e comunicacao exclusiva',
        2
      FROM today_metrics tm
      WHERE tm.segment_ak = 'A'
        AND NOT EXISTS (
          SELECT 1
          FROM public.rfv_tasks t
          WHERE t.customer_id = tm.customer_id
            AND t.task_type = 'vip'
            AND t.task_date >= (v_today - 14)
        )

      UNION ALL

      -- preventive
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'preventivo',
        'importante',
        'manter',
        'Cliente em janela preventiva (70% a 100% do ciclo): contato antes da ruptura de recorrencia',
        3
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.adherence_ratio >= 0.70
        AND tm.adherence_ratio < 1.00

      UNION ALL

      -- post-sale D+3 safe window
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'pos_compra',
        'oportunidade',
        'upsell',
        'Pos-venda D+3: confirmar experiencia e abrir oportunidade de recompra',
        4
      FROM today_metrics tm
      WHERE tm.recency_days BETWEEN 3 AND 4

      UNION ALL

      -- channel migration
      SELECT
        tm.customer_id,
        tm.customer_name,
        tm.purchase_channel,
        tm.segment_ak,
        tm.ticket_avg_12m,
        'migrar_canal',
        'oportunidade',
        'migrar',
        CASE
          WHEN tm.purchase_channel = 'site_only' THEN 'Cliente compra apenas no site: migrar para live'
          ELSE 'Cliente compra apenas na live: migrar para site'
        END,
        5
      FROM today_metrics tm
      WHERE tm.segment_ak <> 'A'
        AND tm.purchase_channel IN ('site_only', 'live_only')
        AND tm.frequency_12m >= 3
        AND tm.recency_days BETWEEN 7 AND 90
    ),
    ranked AS (
      SELECT
        rc.*,
        CASE rc.task_type
          WHEN 'reativacao' THEN round(COALESCE(rc.ticket_avg_12m, 0) * public.rfv_task_probability('reactivation') * public.rfv_segment_weight(rc.segment_ak), 2)
          WHEN 'vip' THEN round(COALESCE(rc.ticket_avg_12m, 0) * public.rfv_task_probability('vip') * public.rfv_segment_weight(rc.segment_ak), 2)
          WHEN 'preventivo' THEN round(COALESCE(rc.ticket_avg_12m, 0) * public.rfv_task_probability('preventive') * public.rfv_segment_weight(rc.segment_ak), 2)
          WHEN 'pos_compra' THEN round(COALESCE(rc.ticket_avg_12m, 0) * public.rfv_task_probability('post_sale') * public.rfv_segment_weight(rc.segment_ak), 2)
          ELSE round(COALESCE(rc.ticket_avg_12m, 0) * public.rfv_task_probability('channel_migration') * public.rfv_segment_weight(rc.segment_ak), 2)
        END AS estimated_impact,
        row_number() OVER (
          PARTITION BY rc.customer_id
          ORDER BY rc.priority_rank ASC, COALESCE(rc.ticket_avg_12m, 0) DESC, rc.task_type ASC
        ) AS rn
      FROM raw_candidates rc
    )
    SELECT
      r.customer_id,
      r.customer_name,
      r.task_type,
      r.priority,
      r.objective,
      r.reason,
      r.estimated_impact,
      CASE
        WHEN r.task_type = 'pos_compra' AND r.purchase_channel = 'live_only' THEN 'live_only'
        WHEN r.task_type = 'pos_compra' AND r.purchase_channel = 'site_only' THEN 'site_only'
        WHEN r.task_type = 'migrar_canal' THEN r.purchase_channel
        ELSE 'all'
      END AS channel_context
    FROM ranked r
    WHERE r.rn = 1
  LOOP
    -- Keep one active (pending) task per customer/day.
    UPDATE public.rfv_tasks t
       SET status = 'skipped',
           executed_at = COALESCE(t.executed_at, now()),
           executed_by = COALESCE(t.executed_by, 'rfv-copilot')
     WHERE t.customer_id = v_row.customer_id
       AND t.task_date = v_today
       AND t.task_type <> v_row.task_type
       AND t.status = 'pendente';

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
      public.resolve_rfv_template(v_row.task_type, v_row.channel_context, v_row.customer_name),
      v_row.objective,
      v_row.channel_context,
      v_row.estimated_impact,
      'pendente',
      CASE WHEN v_row.priority = 'critico' THEN (now() + interval '2 days') ELSE (now() + interval '7 days') END,
      (v_row.task_type IN ('vip', 'pos_compra'))
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
    v_affected := v_affected + v_row_count;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'day', v_today,
    'tasks_created', v_affected,
    'tasks_created_or_refreshed', v_affected
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
        ORDER BY COALESCE(o.paid_at, o.created_at) ASC, o.id ASC
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
  CASE
    WHEN t.status = 'pendente' THEN 'todo'
    WHEN t.status = 'enviado' THEN 'sent'
    WHEN t.status = 'respondeu' THEN 'replied'
    WHEN t.status = 'converteu' THEN 'won'
    WHEN t.status = 'sem_resposta' THEN 'no_reply'
    WHEN t.status IN ('skipped', 'pulou', 'ignorado', 'skipado') THEN 'skipped'
    ELSE 'skipped'
  END AS status,
  t.executed_by AS checked_by,
  t.executed_at AS checked_at,
  t.converted_order_id AS related_order_id,
  t.revenue_generated AS revenue_attributed,
  t.created_at
FROM public.rfv_tasks t;

GRANT SELECT ON public.copilot_tasks TO authenticated;
