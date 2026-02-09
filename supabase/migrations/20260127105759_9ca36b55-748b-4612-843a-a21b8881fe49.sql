-- The previous migration added the columns and function successfully
-- Only the realtime publication line failed because live_cart_items was already added
-- This is a no-op migration to confirm the schema is complete

-- Verify the columns exist (this will do nothing if they already exist)
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS bag_number INTEGER,
ADD COLUMN IF NOT EXISTS separation_status TEXT DEFAULT 'pendente';

ALTER TABLE public.live_cart_items 
ADD COLUMN IF NOT EXISTS separation_status TEXT DEFAULT 'em_separacao',
ADD COLUMN IF NOT EXISTS separation_notes TEXT;