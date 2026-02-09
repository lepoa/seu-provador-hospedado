-- Add missing cancel_reason and canceled_at columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancel_reason text,
ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone;