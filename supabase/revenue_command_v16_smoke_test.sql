-- Revenue Command V1.6 smoke tests (SELECT-only)
-- Run after applying migration 20260224162000_revenue_command_v16.sql.

-- 1) No-orders scenario (uses a sentinel store_id expected to have no data)
SELECT
  public.get_revenue_command(
    current_date - 6,
    current_date,
    'all',
    '00000000-0000-0000-0000-000000000000'::uuid
  ) AS no_orders_result;

-- 2) Cancel impact should be non-zero when canceled amount exists in the same window
WITH base AS (
  SELECT
    COALESCE(SUM(COALESCE(o.total, 0)) FILTER (WHERE lower(COALESCE(o.status, '')) = 'cancelado'), 0)::numeric AS cancelled_total_real_7d
  FROM public.orders o
  WHERE o.created_at >= (current_date - 6)::timestamp
    AND o.created_at < (current_date + 1)::timestamp
),
rpc AS (
  SELECT public.get_revenue_command(current_date - 6, current_date, 'all', NULL::uuid) AS payload
)
SELECT
  b.cancelled_total_real_7d,
  COALESCE((r.payload->'breakdown_componentes'->'cancelamento'->>'impacto_estimado')::numeric, 0) AS impact_cancel_rpc,
  CASE
    WHEN b.cancelled_total_real_7d > 0
      THEN COALESCE((r.payload->'breakdown_componentes'->'cancelamento'->>'impacto_estimado')::numeric, 0) > 0
    ELSE NULL
  END AS check_non_zero_when_cancel_exists
FROM base b
CROSS JOIN rpc r;

-- 3) Baseline ticket is median (compare mean vs median vs RPC baseline)
WITH paid_30 AS (
  SELECT COALESCE(o.total, 0)::numeric AS total
  FROM public.orders o
  WHERE o.created_at >= (current_date - 29)::timestamp
    AND o.created_at < (current_date + 1)::timestamp
    AND public.is_order_paid(o.status, o.payment_status)
),
stats AS (
  SELECT
    COALESCE(AVG(p.total), 0)::numeric(12,2) AS mean_ticket,
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY p.total), 0)::numeric(12,2) AS median_ticket
  FROM paid_30 p
),
rpc AS (
  SELECT public.get_revenue_command(current_date - 6, current_date, 'all', NULL::uuid) AS payload
)
SELECT
  s.mean_ticket,
  s.median_ticket,
  COALESCE((r.payload->'raw'->>'baseline_ticket_value')::numeric, 0) AS rpc_baseline_ticket,
  (COALESCE((r.payload->'raw'->>'baseline_ticket_value')::numeric, 0) = s.median_ticket) AS baseline_matches_median
FROM stats s
CROSS JOIN rpc r;

-- 4) Historical RFV check: impact_rfv uses v_end+1..v_end+7 even for past windows
WITH params AS (
  SELECT
    (current_date - 30)::date AS end_date,
    (current_date - 36)::date AS start_date
),
expected AS (
  SELECT
    COALESCE(SUM(t.estimated_impact), 0)::numeric(12,2) AS expected_impact_rfv
  FROM public.rfv_tasks t
  JOIN params p ON true
  WHERE t.status = 'pendente'
    AND t.task_date >= (p.end_date + 1)
    AND t.task_date <= (p.end_date + 7)
),
rpc AS (
  SELECT public.get_revenue_command(p.start_date, p.end_date, 'all', NULL::uuid) AS payload
  FROM params p
)
SELECT
  e.expected_impact_rfv,
  COALESCE((r.payload->'breakdown_componentes'->'rfv_pendente'->>'impacto_estimado')::numeric, 0) AS rpc_impact_rfv,
  (COALESCE((r.payload->'breakdown_componentes'->'rfv_pendente'->>'impacto_estimado')::numeric, 0) = e.expected_impact_rfv) AS rfv_window_matches
FROM expected e
CROSS JOIN rpc r;

-- 5) Guardrail check: receita_latente <= 1.2 * paid_total
WITH rpc AS (
  SELECT public.get_revenue_command(current_date - 6, current_date, 'all', NULL::uuid) AS payload
)
SELECT
  COALESCE((payload->>'receita_latente')::numeric, 0) AS receita_latente,
  COALESCE((payload->'raw'->>'paid_total')::numeric, 0) AS paid_total,
  (COALESCE((payload->'raw'->>'paid_total')::numeric, 0) * 1.2) AS limite_guardrail,
  COALESCE((payload->>'receita_latente')::numeric, 0) <= (COALESCE((payload->'raw'->>'paid_total')::numeric, 0) * 1.2) AS guardrail_ok
FROM rpc;
