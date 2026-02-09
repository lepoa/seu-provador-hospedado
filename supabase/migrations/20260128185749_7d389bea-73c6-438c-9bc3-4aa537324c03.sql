-- Add payment validation tracking columns
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validated_by_user_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.live_carts.validated_at IS 'Timestamp when admin validated the manual payment';
COMMENT ON COLUMN public.live_carts.validated_by_user_id IS 'Admin user who validated/rejected the payment';
COMMENT ON COLUMN public.live_carts.rejection_reason IS 'Reason for rejecting a manual payment';