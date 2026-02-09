-- Add delivery_period and delivery_notes to orders table for catalog checkout
-- These fields store Motoboy delivery preferences and pickup/shipping notes

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_period text,
ADD COLUMN IF NOT EXISTS delivery_notes text;