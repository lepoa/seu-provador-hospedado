-- Revenue Command V1.6
-- Hardening pass: centralized paid-order rule, cancel impact fix, median baseline,
-- historical RFV window consistency, and latent-revenue guardrail.

DROP FUNCTION IF EXISTS public.get_revenue_command(date, date, text);
DROP FUNCTION IF EXISTS public.get_revenue_command(date, date, text, uuid);

CREATE OR REPLACE FUNCTION public.is_order_paid(
  p_status text,
  p_payment_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_status, '')) = 'cancelado' THEN false
    WHEN lower(COALESCE(p_payment_status, '')) = 'approved' THEN true
    WHEN lower(COALESCE(p_status, '')) IN (
      'pago',
      'confirmado',
      'preparar_envio',
      'etiqueta_gerada',
      'postado',
      'em_rota',
      'retirada',
      'entregue',
      'enviado'
    ) THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_revenue_command(
  p_start_date date,
  p_end_date date,
  p_channel text,
  p_store_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, current_date - 6);
  v_end date := COALESCE(p_end_date, current_date);
  v_channel text;
  v_store_id uuid := p_store_id;
  v_result jsonb;
BEGIN
  IF v_end < v_start THEN
    v_end := v_start;
  END IF;

  v_channel := CASE lower(trim(COALESCE(p_channel, 'all')))
    WHEN 'all' THEN 'all'
    WHEN 'todos' THEN 'all'
    WHEN 'todo' THEN 'all'
    WHEN 'catalog' THEN 'catalog'
    WHEN 'catalogo' THEN 'catalog'
    WHEN 'site' THEN 'catalog'
    WHEN 'live' THEN 'live'
    WHEN 'ao vivo' THEN 'live'
    WHEN 'ao_vivo' THEN 'live'
    WHEN 'ao-vivo' THEN 'live'
    ELSE 'all'
  END;

  WITH scope_orders AS (
    SELECT
      o.id,
      COALESCE(o.total, 0)::numeric AS total,
      public.is_order_paid(o.status, o.payment_status) AS is_paid,
      (lower(COALESCE(o.status, '')) = 'cancelado') AS is_cancelled
    FROM public.orders o
    WHERE o.created_at >= v_start::timestamp
      AND o.created_at < (v_end + 1)::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
      AND (v_store_id IS NULL OR o.user_id = v_store_id)
  ),
  scope_30d_orders AS (
    SELECT
      COALESCE(o.total, 0)::numeric AS total,
      public.is_order_paid(o.status, o.payment_status) AS is_paid
    FROM public.orders o
    WHERE o.created_at >= (v_end - 29)::timestamp
      AND o.created_at < (v_end + 1)::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
      AND (v_store_id IS NULL OR o.user_id = v_store_id)
  ),
  scope_7d_orders AS (
    SELECT
      COALESCE(o.total, 0)::numeric AS total,
      public.is_order_paid(o.status, o.payment_status) AS is_paid
    FROM public.orders o
    WHERE o.created_at >= (v_end - 6)::timestamp
      AND o.created_at < (v_end + 1)::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
      AND (v_store_id IS NULL OR o.user_id = v_store_id)
  ),
  period_agg AS (
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE so.is_cancelled)::int AS cancelled_orders,
      COUNT(*) FILTER (WHERE NOT so.is_cancelled AND NOT so.is_paid)::int AS pending_orders,
      COUNT(*) FILTER (WHERE so.is_paid)::int AS paid_orders,
      COALESCE(SUM(so.total) FILTER (WHERE NOT so.is_cancelled), 0)::numeric AS reserved_total,
      COALESCE(SUM(so.total) FILTER (WHERE so.is_paid), 0)::numeric AS paid_total,
      COALESCE(SUM(so.total) FILTER (WHERE so.is_cancelled), 0)::numeric AS cancelled_total_real
    FROM scope_orders so
  ),
  paid_pieces_agg AS (
    SELECT
      COALESCE(SUM(oi.quantity) FILTER (WHERE oi.product_price > 0 AND so.is_paid), 0)::numeric AS paid_pieces
    FROM scope_orders so
    LEFT JOIN public.order_items oi ON oi.order_id = so.id
  ),
  baseline_ticket AS (
    SELECT
      COALESCE(
        percentile_cont(0.5) WITHIN GROUP (ORDER BY s30.total) FILTER (WHERE s30.is_paid),
        0
      )::numeric AS baseline_ticket_value
    FROM scope_30d_orders s30
  ),
  paid_7d AS (
    SELECT
      COALESCE(SUM(s7.total) FILTER (WHERE s7.is_paid), 0)::numeric AS paid_total_7d
    FROM scope_7d_orders s7
  ),
  pending_rfv AS (
    SELECT
      COALESCE(SUM(t.estimated_impact), 0)::numeric AS impact_rfv
    FROM public.rfv_tasks t
    JOIN public.customers c ON c.id = t.customer_id
    WHERE t.status = 'pendente'
      AND t.task_date >= (v_end + 1)
      AND t.task_date <= (v_end + 7)
      AND (v_store_id IS NULL OR c.user_id = v_store_id)
  ),
  calc AS (
    SELECT
      p.total_orders,
      p.cancelled_orders,
      p.pending_orders,
      p.paid_orders,
      p.reserved_total,
      p.paid_total,
      p.cancelled_total_real,
      b.baseline_ticket_value,
      p7.paid_total_7d,
      r.impact_rfv,
      CASE WHEN p.reserved_total > 0 THEN (p.paid_total * 100.0 / p.reserved_total) ELSE 0 END AS conversion_score,
      CASE WHEN p.paid_orders > 0 THEN (p.paid_total / p.paid_orders) ELSE 0 END AS ticket_value,
      CASE WHEN p.paid_orders > 0 THEN (COALESCE(pp.paid_pieces, 0) / p.paid_orders) ELSE 0 END AS pa_value,
      CASE WHEN p.total_orders > 0 THEN (p.cancelled_orders * 100.0 / p.total_orders) ELSE 0 END AS cancel_percent
    FROM period_agg p
    CROSS JOIN baseline_ticket b
    CROSS JOIN paid_pieces_agg pp
    CROSS JOIN paid_7d p7
    CROSS JOIN pending_rfv r
  ),
  impacts AS (
    SELECT
      c.*,
      GREATEST(0::numeric, 100 - c.conversion_score) AS gap_conversion,
      (GREATEST(0::numeric, 100 - c.conversion_score) / 100.0) * c.paid_total AS impact_conversion,
      (c.baseline_ticket_value * 1.10) AS ideal_ticket,
      CASE
        WHEN (c.baseline_ticket_value * 1.10) > 0
          THEN GREATEST(0::numeric, ((c.baseline_ticket_value * 1.10) - c.ticket_value) / (c.baseline_ticket_value * 1.10))
        ELSE 0::numeric
      END AS gap_ticket_percent,
      CASE
        WHEN (c.baseline_ticket_value * 1.10) > 0
          THEN GREATEST(0::numeric, ((c.baseline_ticket_value * 1.10) - c.ticket_value) / (c.baseline_ticket_value * 1.10)) * c.paid_total
        ELSE 0::numeric
      END AS impact_ticket,
      (c.pending_orders::numeric * c.baseline_ticket_value) AS impact_pending,
      c.cancelled_total_real AS impact_cancel,
      CASE
        WHEN 1.2 > 0 THEN GREATEST(0::numeric, (1.2 - c.pa_value) / 1.2)
        ELSE 0::numeric
      END AS gap_pa,
      CASE
        WHEN 1.2 > 0 THEN GREATEST(0::numeric, (1.2 - c.pa_value) / 1.2) * c.paid_total
        ELSE 0::numeric
      END AS impact_pa
    FROM calc c
  ),
  revenue_calc AS (
    SELECT
      i.*,
      GREATEST(
        0::numeric,
        (i.impact_conversion * 0.30)
        + (i.impact_ticket * 0.20)
        + (i.impact_pending * 0.15)
        + (i.impact_cancel * 0.15)
        + (i.impact_rfv * 0.10)
        + (i.impact_pa * 0.10)
      ) AS receita_latente_raw,
      -- Guardrail: cap latent revenue to 120% of paid revenue in the selected period.
      -- This avoids disproportionate latent estimates on very sparse windows.
      LEAST(
        GREATEST(
          0::numeric,
          (i.impact_conversion * 0.30)
          + (i.impact_ticket * 0.20)
          + (i.impact_pending * 0.15)
          + (i.impact_cancel * 0.15)
          + (i.impact_rfv * 0.10)
          + (i.impact_pa * 0.10)
        ),
        GREATEST(0::numeric, i.paid_total * 1.2)
      ) AS receita_latente_final,
      (i.paid_total_7d / 7.0) AS media_diaria_7d
    FROM impacts i
  ),
  projections AS (
    SELECT
      rc.*,
      (rc.media_diaria_7d * 30.0) AS projecao_30d_base,
      ((rc.media_diaria_7d * 30.0) + (rc.receita_latente_final * 0.6)) AS projecao_30d_otimizada
    FROM revenue_calc rc
  ),
  actions AS (
    SELECT
      a.tipo,
      a.impacto_estimado,
      a.recomendacao
    FROM projections p
    CROSS JOIN LATERAL (
      VALUES
        ('Conversao'::text, p.impact_conversion, 'Otimizar jornada de fechamento'::text),
        ('Ticket Medio'::text, p.impact_ticket, 'Elevar valor medio com estrategia de combinacao'::text),
        ('Pendencias'::text, p.impact_pending, 'Resolver pedidos pendentes nas proximas 24h'::text),
        ('Cancelamento'::text, p.impact_cancel, 'Atuar preventivamente na confirmacao e prazo'::text),
        ('RFV Pendente'::text, p.impact_rfv, 'Executar tarefas RFV priorizadas da semana'::text),
        ('Pecas por Atendimento'::text, p.impact_pa, 'Incentivar segunda peca por atendimento'::text)
    ) AS a(tipo, impacto_estimado, recomendacao)
    ORDER BY a.impacto_estimado DESC, a.tipo ASC
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'receita_latente', ROUND(p.receita_latente_final, 2),
    'projecao_30d_base', ROUND(p.projecao_30d_base, 2),
    'projecao_30d_otimizada', ROUND(p.projecao_30d_otimizada, 2),
    'diferenca_projetada', ROUND((p.projecao_30d_otimizada - p.projecao_30d_base), 2),
    'acoes_priorizadas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'tipo', a.tipo,
          'impacto_estimado', ROUND(a.impacto_estimado, 2),
          'recomendacao', a.recomendacao
        )
        ORDER BY a.impacto_estimado DESC, a.tipo ASC
      )
      FROM actions a
    ), '[]'::jsonb),
    'breakdown_componentes', jsonb_build_object(
      'conversion', jsonb_build_object(
        'score_atual', ROUND(p.conversion_score, 2),
        'ideal', 100,
        'gap', ROUND(p.gap_conversion, 2),
        'impacto_estimado', ROUND(p.impact_conversion, 2)
      ),
      'ticket', jsonb_build_object(
        'score_atual', ROUND(p.ticket_value, 2),
        'ideal', ROUND(p.ideal_ticket, 2),
        'gap_percent', ROUND((p.gap_ticket_percent * 100.0), 2),
        'impacto_estimado', ROUND(p.impact_ticket, 2)
      ),
      'pendencias', jsonb_build_object(
        'pedidos_pendentes', p.pending_orders,
        'impacto_estimado', ROUND(p.impact_pending, 2)
      ),
      'cancelamento', jsonb_build_object(
        'cancel_percent', ROUND(p.cancel_percent, 2),
        'cancelled_total_real', ROUND(p.cancelled_total_real, 2),
        'reserved_total_periodo', ROUND(p.reserved_total, 2),
        'impacto_estimado', ROUND(p.impact_cancel, 2)
      ),
      'rfv_pendente', jsonb_build_object(
        'impacto_estimado', ROUND(p.impact_rfv, 2)
      ),
      'pa', jsonb_build_object(
        'score_atual', ROUND(p.pa_value, 2),
        'ideal', 1.2,
        'gap_percent', ROUND((p.gap_pa * 100.0), 2),
        'impacto_estimado', ROUND(p.impact_pa, 2)
      )
    ),
    'raw', jsonb_build_object(
      'paid_total', ROUND(p.paid_total, 2),
      'reserved_total', ROUND(p.reserved_total, 2),
      'cancelled_total_real', ROUND(p.cancelled_total_real, 2),
      'paid_total_7d', ROUND(p.paid_total_7d, 2),
      'baseline_ticket_value', ROUND(p.baseline_ticket_value, 2),
      'conversion_score', ROUND(p.conversion_score, 2),
      'ticket_value', ROUND(p.ticket_value, 2),
      'pa_value', ROUND(p.pa_value, 2),
      'cancel_percent', ROUND(p.cancel_percent, 2),
      'impact_conversion', ROUND(p.impact_conversion, 2),
      'impact_ticket', ROUND(p.impact_ticket, 2),
      'impact_pending', ROUND(p.impact_pending, 2),
      'impact_cancel', ROUND(p.impact_cancel, 2),
      'impact_rfv', ROUND(p.impact_rfv, 2),
      'impact_pa', ROUND(p.impact_pa, 2),
      'receita_latente_raw', ROUND(p.receita_latente_raw, 2),
      'receita_latente_cap', ROUND(GREATEST(0::numeric, p.paid_total * 1.2), 2)
    )
  )
  INTO v_result
  FROM projections p;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'receita_latente', 0,
      'projecao_30d_base', 0,
      'projecao_30d_otimizada', 0,
      'diferenca_projetada', 0,
      'acoes_priorizadas', '[]'::jsonb,
      'breakdown_componentes', '{}'::jsonb,
      'raw', jsonb_build_object(
        'paid_total', 0,
        'reserved_total', 0,
        'cancelled_total_real', 0,
        'paid_total_7d', 0,
        'baseline_ticket_value', 0,
        'conversion_score', 0,
        'ticket_value', 0,
        'pa_value', 0,
        'cancel_percent', 0,
        'impact_conversion', 0,
        'impact_ticket', 0,
        'impact_pending', 0,
        'impact_cancel', 0,
        'impact_rfv', 0,
        'impact_pa', 0,
        'receita_latente_raw', 0,
        'receita_latente_cap', 0
      )
    )
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at
  ON public.orders(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_rfv_tasks_status_task_date_customer
  ON public.rfv_tasks(status, task_date, customer_id);

CREATE INDEX IF NOT EXISTS idx_customers_user_id_id
  ON public.customers(user_id, id);

GRANT EXECUTE ON FUNCTION public.get_revenue_command(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_command(date, date, text, uuid) TO service_role;
