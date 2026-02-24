-- RFV Performance Insights KPI RPC (last 30 days).
-- Uses only rfv_tasks + rfv_daily.

CREATE OR REPLACE FUNCTION public.get_rfv_performance_insights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH params AS (
    SELECT current_date AS today, (current_date - 29)::date AS start_day
  ),
  task_scope AS (
    SELECT
      t.id,
      t.customer_id,
      t.task_type,
      t.task_date,
      t.status,
      COALESCE(t.estimated_impact, 0)::numeric(12,2) AS estimated_impact,
      COALESCE(t.revenue_generated, 0)::numeric(12,2) AS revenue_generated,
      (t.status IN ('converteu', 'won')) AS is_converted
    FROM public.rfv_tasks t
    JOIN params p
      ON t.task_date BETWEEN p.start_day AND p.today
  ),
  task_with_segment AS (
    SELECT
      ts.*,
      COALESCE(ds.segment_ak, 'unknown') AS segment_ak
    FROM task_scope ts
    LEFT JOIN LATERAL (
      SELECT d.segment_ak
      FROM public.rfv_daily d
      WHERE d.customer_id = ts.customer_id
        AND d.day <= ts.task_date
      ORDER BY d.day DESC
      LIMIT 1
    ) ds ON true
  ),
  conversion_by_type AS (
    SELECT
      ts.task_type,
      COUNT(*)::int AS total,
      SUM(CASE WHEN ts.is_converted THEN 1 ELSE 0 END)::int AS converted,
      ROUND(
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (SUM(CASE WHEN ts.is_converted THEN 1 ELSE 0 END)::numeric * 100.0 / COUNT(*))
        END,
        2
      ) AS rate
    FROM task_scope ts
    GROUP BY ts.task_type
  ),
  impact AS (
    SELECT
      ROUND(COALESCE(SUM(ts.estimated_impact), 0), 2) AS estimated,
      ROUND(
        COALESCE(
          SUM(CASE WHEN ts.is_converted THEN ts.revenue_generated ELSE 0 END),
          0
        ),
        2
      ) AS real
    FROM task_scope ts
  ),
  segment_conversion AS (
    SELECT
      tws.segment_ak,
      COUNT(*)::int AS total,
      SUM(CASE WHEN tws.is_converted THEN 1 ELSE 0 END)::int AS converted,
      ROUND(
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (SUM(CASE WHEN tws.is_converted THEN 1 ELSE 0 END)::numeric * 100.0 / COUNT(*))
        END,
        2
      ) AS rate
    FROM task_with_segment tws
    GROUP BY tws.segment_ak
  )
  SELECT jsonb_build_object(
    'last_30d_revenue',
    COALESCE((SELECT i.real FROM impact i), 0),
    'conversion_by_type',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'task_type', c.task_type,
            'total', c.total,
            'converted', c.converted,
            'rate', c.rate
          )
          ORDER BY c.rate DESC, c.total DESC, c.task_type ASC
        )
        FROM conversion_by_type c
      ),
      '[]'::jsonb
    ),
    'impact_analysis',
    jsonb_build_object(
      'estimated', COALESCE((SELECT i.estimated FROM impact i), 0),
      'real', COALESCE((SELECT i.real FROM impact i), 0),
      'efficiency_percent',
      ROUND(
        CASE
          WHEN COALESCE((SELECT i.estimated FROM impact i), 0) <= 0 THEN 0
          ELSE COALESCE((SELECT i.real FROM impact i), 0) * 100.0 / (SELECT i.estimated FROM impact i)
        END,
        2
      )
    ),
    'segment_conversion',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'segment_ak', s.segment_ak,
            'total', s.total,
            'converted', s.converted,
            'rate', s.rate
          )
          ORDER BY s.rate DESC, s.total DESC, s.segment_ak ASC
        )
        FROM segment_conversion s
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rfv_performance_insights() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rfv_performance_insights() TO service_role;
