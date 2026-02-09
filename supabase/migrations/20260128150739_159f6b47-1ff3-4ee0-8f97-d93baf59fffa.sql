-- Add status column to live_raffles table for pending/applied workflow
ALTER TABLE public.live_raffles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Add applied_at timestamp to track when prize was applied
ALTER TABLE public.live_raffles 
ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone;

-- Add comment for clarity
COMMENT ON COLUMN public.live_raffles.status IS 'pending = winner revealed but prize not applied yet, applied = prize added to cart, cancelled = raffle cancelled';
COMMENT ON COLUMN public.live_raffles.applied_at IS 'Timestamp when the prize was applied to the cart';