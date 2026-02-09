-- Add label_printed_at to track when label was first/last printed
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS label_printed_at timestamp with time zone DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.live_carts.label_printed_at IS 'Timestamp of when the bag label was last printed. NULL means never printed.';
COMMENT ON COLUMN public.live_carts.needs_label_reprint IS 'True only if label was printed before AND cart was modified after. Cannot be true if label_printed_at is NULL.';