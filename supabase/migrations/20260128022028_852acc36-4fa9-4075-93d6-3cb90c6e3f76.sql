-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily business insights generation at 8:00 AM (Brazil timezone)
SELECT cron.schedule(
  'generate-business-insights-daily',
  '0 11 * * *',  -- 11:00 UTC = 8:00 AM BRT (Brasília Time)
  $$
  SELECT net.http_post(
    url := 'https://fozxeyiqulvpbbawjznw.supabase.co/functions/v1/generate-business-insights',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvenhleWlxdWx2cGJiYXdqem53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDkzNDMsImV4cCI6MjA4NDY4NTM0M30.6lAfTHnKVABqwq5EwYAIL4qE9c87w1FL54P6rLUken8"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);