-- Alterar o padrão de expiração de reservas de 30 minutos para 7 dias (10080 minutos)
ALTER TABLE public.live_events 
ALTER COLUMN reservation_expiry_minutes SET DEFAULT 10080;

-- Atualizar lives existentes que usam o padrão antigo de 30 minutos
UPDATE public.live_events 
SET reservation_expiry_minutes = 10080 
WHERE reservation_expiry_minutes = 30;