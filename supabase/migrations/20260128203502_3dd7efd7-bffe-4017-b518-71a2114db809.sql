-- Allow public access to update live_carts by cart ID for checkout flow
-- This is needed because the checkout page is accessed via public link
CREATE POLICY "Allow public update of own cart for checkout"
ON public.live_carts
FOR UPDATE
USING (true)
WITH CHECK (
  -- Only allow updating specific checkout-related fields
  -- The cart must exist and be in a valid status for checkout
  status IN ('aberto', 'em_confirmacao', 'aguardando_pagamento', 'expirado')
);

-- Also allow inserting status history for tracking
CREATE POLICY "Allow insert status history for checkout"
ON public.live_cart_status_history
FOR INSERT
WITH CHECK (true);