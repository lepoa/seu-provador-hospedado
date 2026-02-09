-- Add operational fields to live_carts table
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS customer_live_notes TEXT,
ADD COLUMN IF NOT EXISTS is_raffle_winner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS raffle_name TEXT,
ADD COLUMN IF NOT EXISTS raffle_prize TEXT,
ADD COLUMN IF NOT EXISTS raffle_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_label_reprint BOOLEAN DEFAULT false;