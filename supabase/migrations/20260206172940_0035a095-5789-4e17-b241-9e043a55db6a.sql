
-- Schedule expiration via pg_cron (skip if not available)
DO $do$
BEGIN
  PERFORM cron.schedule(
    'expire-pending-orders',
    '*/15 * * * *',
    'SELECT public.expire_pending_orders()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available';
END;
$do$;
