
-- 1. Add public_token column with auto-generation
ALTER TABLE public.live_carts 
ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid();

-- 2. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_live_carts_public_token ON public.live_carts(public_token);

-- 3. Drop the insecure public SELECT policy
DROP POLICY IF EXISTS "Public can view cart for checkout" ON public.live_carts;

-- 4. Drop the public UPDATE policy (checkout updates go through edge functions)
DROP POLICY IF EXISTS "Public can update cart for checkout" ON public.live_carts;

-- 5. Drop old public SELECT on live_cart_items
DROP POLICY IF EXISTS "Public can view cart items for checkout" ON public.live_cart_items;

-- NOTE: Merchants/admins keep full access via existing "Merchants can manage live carts" ALL policy.
-- Public checkout access is handled exclusively through the get-live-cart-public edge function (service_role).
-- No anon/public RLS policy is needed since all public access goes through the edge function.
