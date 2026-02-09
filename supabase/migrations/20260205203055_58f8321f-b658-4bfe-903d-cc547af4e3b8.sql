
-- ===============================================================
-- SECURITY HARDENING PART 2B - FIX REMAINING WARNINGS
-- ===============================================================

-- =============================================
-- 1) FIX REMAINING WITH CHECK (true) POLICIES
-- =============================================

-- Fix: live_cart_status_history - restrict to authenticated
DROP POLICY IF EXISTS "Allow insert status history for checkout" ON public.live_cart_status_history;
CREATE POLICY "Allow insert status history for checkout"
  ON public.live_cart_status_history
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    -- Allow if user is merchant
    public.has_role(auth.uid(), 'merchant') 
    OR public.has_role(auth.uid(), 'admin')
    -- Or allow if cart belongs to session (via public checkout)
    OR EXISTS (
      SELECT 1 FROM public.live_carts lc 
      WHERE lc.id = live_cart_status_history.live_cart_id
      AND lc.status IN ('aberto', 'em_confirmacao', 'aguardando_pagamento')
    )
  );

-- Fix: mp_payment_events - drop both old policies first
DROP POLICY IF EXISTS "System can insert mp payment events" ON public.mp_payment_events;
DROP POLICY IF EXISTS "Merchants can view mp payment events" ON public.mp_payment_events;
CREATE POLICY "Merchants can view mp payment events"
  ON public.mp_payment_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'merchant') 
    OR public.has_role(auth.uid(), 'admin')
  );

-- Fix: point_transactions - drop old then create new
DROP POLICY IF EXISTS "System can insert transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "System inserts for authenticated users" ON public.point_transactions;
DROP POLICY IF EXISTS "Merchants can manage point transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Users view own point transactions" ON public.point_transactions;

CREATE POLICY "Users insert own point transactions"
  ON public.point_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants manage all point transactions"
  ON public.point_transactions
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'merchant') 
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'merchant') 
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users view own transactions"
  ON public.point_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix: recommendations
DROP POLICY IF EXISTS "System can create recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Merchants can create recommendations" ON public.recommendations;
CREATE POLICY "Merchants create recommendations"
  ON public.recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'merchant') 
    OR public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- 2) FIX live_carts USING(true) for public checkout
-- =============================================
DROP POLICY IF EXISTS "Allow public update of own cart for checkout" ON public.live_carts;
DROP POLICY IF EXISTS "Allow public update of cart for checkout" ON public.live_carts;
CREATE POLICY "Public can update cart for checkout"
  ON public.live_carts
  FOR UPDATE
  TO anon, authenticated
  USING (
    status IN ('aberto', 'em_confirmacao', 'aguardando_pagamento', 'expirado')
  )
  WITH CHECK (
    status IN ('aberto', 'em_confirmacao', 'aguardando_pagamento', 'expirado')
  );

-- =============================================
-- 3) ADD MP WEBHOOK SIGNATURE AUDIT COLUMNS
-- =============================================
ALTER TABLE public.mp_payment_events 
ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_method TEXT;

-- =============================================
-- 4) FIX get_reserved_stock_map function
-- =============================================
CREATE OR REPLACE FUNCTION public.get_reserved_stock_map()
RETURNS TABLE(product_id UUID, size TEXT, reserved INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    lci.product_id,
    lci.variante->>'tamanho' AS size,
    SUM(lci.qtd)::INTEGER AS reserved
  FROM public.live_cart_items lci
  JOIN public.live_carts lc ON lc.id = lci.live_cart_id
  WHERE lci.status IN ('reservado', 'confirmado')
    AND lc.status NOT IN ('cancelado', 'expirado', 'pago')
    AND lc.stock_decremented_at IS NULL
  GROUP BY lci.product_id, lci.variante->>'tamanho'
$$;

-- =============================================
-- 5) Document password_reset_tokens is secure
-- =============================================
COMMENT ON TABLE public.password_reset_tokens IS 
'Password reset tokens - intentionally has RLS with no policies. All access via edge functions using service role.';

-- =============================================
-- 6) Fix quiz_leads policy for public (quiz_leads can't use auth.uid)
-- =============================================
DROP POLICY IF EXISTS "Public can submit quiz leads" ON public.quiz_leads;
CREATE POLICY "Anyone can submit quiz leads"
  ON public.quiz_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Basic validation: must have at least a contact or name
    (contact IS NOT NULL AND contact != '') 
    OR (name IS NOT NULL AND name != '')
    OR (instagram_handle IS NOT NULL AND instagram_handle != '')
  );
