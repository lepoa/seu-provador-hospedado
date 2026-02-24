-- Dashboard Intelligence V1
-- - Business Health Score (real-time by period/channel)
-- - 7-day projection (moving average + pending RFV impact)

CREATE OR REPLACE FUNCTION public.get_business_health_score(
  p_start_date date,
  p_end_date date,
  p_channel text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, current_date - 6);
  v_end date := COALESCE(p_end_date, current_date);
  v_channel text := COALESCE(lower(p_channel), 'all');
  v_days integer;
  v_result jsonb;
BEGIN
  IF v_end < v_start THEN
    v_end := v_start;
  END IF;

  v_days := GREATEST(1, (v_end - v_start) + 1);

  WITH scope_orders AS (
    SELECT
      o.id,
      o.created_at::date AS day,
      o.status,
      COALESCE(o.total, 0)::numeric AS total,
      COALESCE(o.payment_status, '') AS payment_status,
      COALESCE(o.source, 'catalog') AS source,
      o.live_event_id
    FROM public.orders o
    WHERE o.created_at >= v_start::timestamp
      AND o.created_at < (v_end + 1)::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
  ),
  scope_prev_orders AS (
    SELECT
      o.id,
      COALESCE(o.total, 0)::numeric AS total,
      o.status,
      COALESCE(o.payment_status, '') AS payment_status
    FROM public.orders o
    WHERE o.created_at >= (v_start - v_days)::timestamp
      AND o.created_at < v_start::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
  ),
  scope_last_30_orders AS (
    SELECT
      o.id,
      COALESCE(o.total, 0)::numeric AS total,
      o.status,
      COALESCE(o.payment_status, '') AS payment_status
    FROM public.orders o
    WHERE o.created_at >= (v_end - 29)::timestamp
      AND o.created_at < (v_end + 1)::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
  ),
  scope_last_7_orders AS (
    SELECT
      o.id,
      o.created_at::date AS day,
      COALESCE(o.total, 0)::numeric AS total,
      o.status,
      COALESCE(o.payment_status, '') AS payment_status
    FROM public.orders o
    WHERE o.created_at >= (v_end - 6)::timestamp
      AND o.created_at < (v_end + 1)::timestamp
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND COALESCE(o.source, 'catalog') <> 'live' AND o.live_event_id IS NULL)
        OR (v_channel = 'live' AND (COALESCE(o.source, 'catalog') = 'live' OR o.live_event_id IS NOT NULL))
      )
  ),
  main_agg AS (
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE so.status = 'cancelado')::int AS cancelled_orders,
      COUNT(*) FILTER (
        WHERE so.status <> 'cancelado'
          AND NOT (so.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
                   OR so.payment_status = 'approved')
      )::int AS pending_orders,
      COUNT(*) FILTER (
        WHERE (so.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
               OR so.payment_status = 'approved')
      )::int AS paid_orders,
      COALESCE(SUM(so.total) FILTER (WHERE so.status <> 'cancelado'), 0)::numeric AS reserved_total,
      COALESCE(SUM(so.total) FILTER (
        WHERE (so.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
               OR so.payment_status = 'approved')
      ), 0)::numeric AS paid_total
    FROM scope_orders so
  ),
  paid_pieces_agg AS (
    SELECT
      COALESCE(SUM(oi.quantity) FILTER (
        WHERE oi.product_price > 0
          AND (
            so.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
            OR so.payment_status = 'approved'
          )
      ), 0)::numeric AS paid_pieces
    FROM scope_orders so
    LEFT JOIN public.order_items oi ON oi.order_id = so.id
  ),
  prev_agg AS (
    SELECT
      COALESCE(SUM(spo.total) FILTER (
        WHERE (spo.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
               OR spo.payment_status = 'approved')
      ), 0)::numeric AS previous_paid_total
    FROM scope_prev_orders spo
  ),
  baseline_ticket AS (
    SELECT
      CASE
        WHEN COUNT(*) FILTER (
          WHERE (sl30.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
                 OR sl30.payment_status = 'approved')
        ) > 0
        THEN COALESCE(SUM(sl30.total) FILTER (
          WHERE (sl30.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
                 OR sl30.payment_status = 'approved')
        ), 0)::numeric / COUNT(*) FILTER (
          WHERE (sl30.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
                 OR sl30.payment_status = 'approved')
        )
        ELSE 0::numeric
      END AS baseline_ticket_value
    FROM scope_last_30_orders sl30
  ),
  recurrence AS (
    SELECT
      COALESCE(
        AVG(d.score_recorrencia),
        50
      )::numeric AS recurrence_score
    FROM public.rfv_daily d
    WHERE d.day = (
      SELECT MAX(d2.day)
      FROM public.rfv_daily d2
      WHERE d2.day <= v_end
    )
      AND (
        v_channel = 'all'
        OR (v_channel = 'catalog' AND d.purchase_channel IN ('site_only', 'hybrid'))
        OR (v_channel = 'live' AND d.purchase_channel IN ('live_only', 'hybrid'))
      )
  ),
  daily_agg_7d AS (
    SELECT
      s7.day,
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE s7.status = 'cancelado')::int AS cancelled_orders,
      COUNT(*) FILTER (
        WHERE s7.status <> 'cancelado'
          AND NOT (s7.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
                   OR s7.payment_status = 'approved')
      )::int AS pending_orders,
      COUNT(*) FILTER (
        WHERE (s7.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
               OR s7.payment_status = 'approved')
      )::int AS paid_orders,
      COALESCE(SUM(s7.total) FILTER (WHERE s7.status <> 'cancelado'), 0)::numeric AS reserved_total,
      COALESCE(SUM(s7.total) FILTER (
        WHERE (s7.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
               OR s7.payment_status = 'approved')
      ), 0)::numeric AS paid_total
    FROM scope_last_7_orders s7
    GROUP BY s7.day
  ),
  daily_pieces_7d AS (
    SELECT
      s7.day,
      COALESCE(SUM(oi.quantity) FILTER (
        WHERE oi.product_price > 0
          AND (
            s7.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
            OR s7.payment_status = 'approved'
          )
      ), 0)::numeric AS paid_pieces
    FROM scope_last_7_orders s7
    LEFT JOIN public.order_items oi ON oi.order_id = s7.id
    GROUP BY s7.day
  ),
  trend_7d AS (
    SELECT
      COALESCE(AVG(
        (
          LEAST(100, GREATEST(0, CASE WHEN d.reserved_total > 0 THEN (d.paid_total * 100.0 / d.reserved_total) ELSE 0 END)) * 0.25
          + LEAST(100, GREATEST(
              0,
              CASE
                WHEN bt.baseline_ticket_value > 0 AND d.paid_orders > 0
                  THEN ((d.paid_total / d.paid_orders) / (bt.baseline_ticket_value * 1.1)) * 100.0
                WHEN d.paid_orders > 0 THEN 70
                ELSE 0
              END
            )) * 0.20
          + LEAST(100, GREATEST(
              0,
              CASE
                WHEN d.paid_orders > 0 THEN ((COALESCE(dp.paid_pieces, 0) / d.paid_orders) / 1.2) * 100.0
                ELSE 0
              END
            )) * 0.20
          + LEAST(100, GREATEST(0, 100 - (CASE WHEN d.total_orders > 0 THEN (d.cancelled_orders * 100.0 / d.total_orders) ELSE 0 END) * 5)) * 0.15
          + LEAST(100, GREATEST(0, 100 - (CASE WHEN d.total_orders > 0 THEN (d.pending_orders * 100.0 / d.total_orders) ELSE 0 END) * 2)) * 0.10
          + LEAST(100, GREATEST(0, r.recurrence_score)) * 0.10
        )
      ), 0)::numeric AS avg_daily_score
    FROM daily_agg_7d d
    LEFT JOIN daily_pieces_7d dp ON dp.day = d.day
    CROSS JOIN baseline_ticket bt
    CROSS JOIN recurrence r
  ),
  current_calc AS (
    SELECT
      ma.total_orders,
      ma.cancelled_orders,
      ma.pending_orders,
      ma.paid_orders,
      ma.reserved_total,
      ma.paid_total,
      ppa.paid_pieces,
      pa.previous_paid_total,
      bt.baseline_ticket_value,
      r.recurrence_score,
      CASE WHEN ma.reserved_total > 0 THEN (ma.paid_total * 100.0 / ma.reserved_total) ELSE 0 END AS conversion_percent,
      CASE WHEN ma.paid_orders > 0 THEN (ma.paid_total / ma.paid_orders) ELSE 0 END AS ticket_value,
      CASE WHEN ma.paid_orders > 0 THEN (COALESCE(ppa.paid_pieces, 0) / ma.paid_orders) ELSE 0 END AS pa_value,
      CASE WHEN ma.total_orders > 0 THEN (ma.cancelled_orders * 100.0 / ma.total_orders) ELSE 0 END AS cancel_percent,
      CASE WHEN ma.total_orders > 0 THEN (ma.pending_orders * 100.0 / ma.total_orders) ELSE 0 END AS pending_rate,
      CASE
        WHEN pa.previous_paid_total > 0 THEN ((ma.paid_total - pa.previous_paid_total) * 100.0 / pa.previous_paid_total)
        WHEN ma.paid_total > 0 THEN 100
        ELSE 0
      END AS growth_percent
    FROM main_agg ma
    CROSS JOIN paid_pieces_agg ppa
    CROSS JOIN prev_agg pa
    CROSS JOIN baseline_ticket bt
    CROSS JOIN recurrence r
  ),
  scored AS (
    SELECT
      cc.*,
      LEAST(100, GREATEST(0, cc.conversion_percent)) AS conversion_score,
      LEAST(100, GREATEST(
        0,
        CASE
          WHEN cc.baseline_ticket_value > 0 THEN (cc.ticket_value / (cc.baseline_ticket_value * 1.1)) * 100.0
          WHEN cc.ticket_value > 0 THEN 70
          ELSE 0
        END
      )) AS ticket_score,
      LEAST(100, GREATEST(0, (cc.pa_value / 1.2) * 100.0)) AS pa_score,
      LEAST(100, GREATEST(0, 100 - (cc.cancel_percent * 5))) AS cancel_score,
      LEAST(100, GREATEST(0, 100 - (cc.pending_rate * 2))) AS pendencias_score,
      LEAST(100, GREATEST(0, 50 + cc.growth_percent)) AS growth_score,
      LEAST(100, GREATEST(0, cc.recurrence_score)) AS recorrencia_score
    FROM current_calc cc
  ),
  final AS (
    SELECT
      ROUND(
        (
          s.conversion_score * 0.20
          + s.ticket_score * 0.15
          + s.pa_score * 0.15
          + s.cancel_score * 0.15
          + s.pendencias_score * 0.10
          + s.growth_score * 0.15
          + s.recorrencia_score * 0.10
        )::numeric,
        2
      ) AS health_score,
      s.*,
      t.avg_daily_score
    FROM scored s
    CROSS JOIN trend_7d t
  )
  SELECT jsonb_build_object(
    'score', ROUND(f.health_score),
    'classification',
      CASE
        WHEN f.health_score >= 80 THEN 'strong'
        WHEN f.health_score >= 65 THEN 'stable'
        WHEN f.health_score >= 45 THEN 'attention'
        ELSE 'risk'
      END,
    'trend', ROUND((f.health_score - COALESCE(f.avg_daily_score, f.health_score))::numeric, 2),
    'components', jsonb_build_object(
      'conversion', ROUND(f.conversion_score, 2),
      'ticket', ROUND(f.ticket_score, 2),
      'pa', ROUND(f.pa_score, 2),
      'cancel', ROUND(f.cancel_score, 2),
      'pendencias', ROUND(f.pendencias_score, 2),
      'growth', ROUND(f.growth_score, 2),
      'recorrencia', ROUND(f.recorrencia_score, 2)
    ),
    'raw', jsonb_build_object(
      'conversion_percent', ROUND(f.conversion_percent, 2),
      'ticket_value', ROUND(f.ticket_value, 2),
      'pa_value', ROUND(f.pa_value, 2),
      'cancel_percent', ROUND(f.cancel_percent, 2),
      'pending_rate', ROUND(f.pending_rate, 2),
      'pending_orders', f.pending_orders,
      'growth_percent', ROUND(f.growth_percent, 2),
      'recurrence_score', ROUND(f.recurrence_score, 2)
    )
  )
  INTO v_result
  FROM final f;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'score', 0,
      'classification', 'risk',
      'trend', 0,
      'components', jsonb_build_object(
        'conversion', 0,
        'ticket', 0,
        'pa', 0,
        'cancel', 0,
        'pendencias', 0,
        'growth', 0,
        'recorrencia', 0
      ),
      'raw', jsonb_build_object(
        'conversion_percent', 0,
        'ticket_value', 0,
        'pa_value', 0,
        'cancel_percent', 0,
        'pending_rate', 0,
        'pending_orders', 0,
        'growth_percent', 0,
        'recurrence_score', 0
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_projection(
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor_end date := COALESCE(p_end_date, current_date);
  v_result jsonb;
BEGIN
  WITH revenue_7d AS (
    SELECT
      COALESCE(SUM(o.total) FILTER (
        WHERE (o.status IN ('pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue')
               OR COALESCE(o.payment_status, '') = 'approved')
      ), 0)::numeric AS paid_total_7d
    FROM public.orders o
    WHERE o.created_at >= (v_anchor_end - 6)::timestamp
      AND o.created_at < (v_anchor_end + 1)::timestamp
  ),
  pending_rfv AS (
    SELECT
      COALESCE(SUM(t.estimated_impact), 0)::numeric AS pending_impact_7d
    FROM public.rfv_tasks t
    WHERE t.status = 'pendente'
      AND t.task_date >= GREATEST(current_date, v_anchor_end + 1)
      AND t.task_date <= (v_anchor_end + 7)
  )
  SELECT jsonb_build_object(
    'average_daily_7d', ROUND((r.paid_total_7d / 7.0)::numeric, 2),
    'rfv_pending_impact_7d', ROUND(p.pending_impact_7d, 2),
    'projected_7d_revenue', ROUND(((r.paid_total_7d / 7.0) * 7 + p.pending_impact_7d)::numeric, 2)
  )
  INTO v_result
  FROM revenue_7d r
  CROSS JOIN pending_rfv p;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'average_daily_7d', 0,
      'rfv_pending_impact_7d', 0,
      'projected_7d_revenue', 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_health_score(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_health_score(date, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_business_projection(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_projection(date, date) TO service_role;
