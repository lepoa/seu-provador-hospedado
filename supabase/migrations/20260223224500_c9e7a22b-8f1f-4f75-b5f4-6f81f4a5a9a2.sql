-- RFV daily automation (08:00 America/Sao_Paulo) with idempotency and audit log.
-- Uses pg_cron and a secure wrapper around run_rfv_copilot().

-- 1) Ensure pg_cron extension is available.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Execution log for observability/audit.
CREATE TABLE IF NOT EXISTS public.rfv_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  execution_day date NOT NULL DEFAULT current_date,
  result jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_rfv_execution_log_day ON public.rfv_execution_log (execution_day DESC);
CREATE INDEX IF NOT EXISTS idx_rfv_execution_log_status ON public.rfv_execution_log (status);

-- Extra protection against duplicate successful runs in the same day.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfv_execution_log_success_day_uniq
  ON public.rfv_execution_log (execution_day)
  WHERE status = 'success';

-- 3) Secure/idempotent wrapper function.
CREATE OR REPLACE FUNCTION public.run_rfv_copilot_with_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Avoid duplicate success execution in the same day.
  IF EXISTS (
    SELECT 1
    FROM public.rfv_execution_log
    WHERE execution_day = current_date
      AND status = 'success'
  ) THEN
    RETURN;
  END IF;

  v_result := public.run_rfv_copilot();

  INSERT INTO public.rfv_execution_log (result, status)
  VALUES (v_result, 'success');
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent run inserted success first; keep idempotent behavior.
    RETURN;
  WHEN OTHERS THEN
    INSERT INTO public.rfv_execution_log (result, status, error_message)
    VALUES (NULL, 'error', sqlerrm);
END;
$$;

REVOKE ALL ON FUNCTION public.run_rfv_copilot_with_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_rfv_copilot_with_log() TO postgres, service_role;

-- 4) Schedule daily job at 08:00 BRT with timezone-aware UTC adjustment.
DO $do$
DECLARE
  v_tz text;
  v_schedule text;
  v_job_id bigint;
BEGIN
  v_tz := current_setting('TimeZone');

  -- If DB is UTC, 08:00 America/Sao_Paulo = 11:00 UTC.
  IF upper(v_tz) = 'UTC' THEN
    v_schedule := '0 11 * * *';
  ELSE
    v_schedule := '0 8 * * *';
  END IF;

  -- Remove previous schedule with the same name to keep migration rerunnable.
  FOR v_job_id IN
    SELECT j.jobid
    FROM cron.job j
    WHERE j.jobname = 'rfv_daily_job'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'rfv_daily_job',
    v_schedule,
    $cmd$SELECT public.run_rfv_copilot_with_log();$cmd$
  );
END;
$do$;

