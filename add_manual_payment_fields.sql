-- Migration: Add manual payment fields to orders table
-- This allows catalog orders to also support receipt uploads and manager approval

ALTER TABLE IF EXISTS public.orders 
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
ADD COLUMN IF NOT EXISTS payment_review_status TEXT DEFAULT 'pending'::text;

-- Update the check constraint for order status if it exists, or just ensure the status is supported in frontend logic.
-- In this system, 'aguardando_validacao_pagamento' will be used.

COMMENT ON COLUMN public.orders.payment_proof_url IS 'URL for the uploaded payment receipt (Supabase Storage)';
COMMENT ON COLUMN public.orders.payment_review_status IS 'Status of the manual payment review (pending, approved, rejected)';
