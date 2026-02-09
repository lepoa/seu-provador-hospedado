
-- ==============================================
-- FIX 1: Restrict merchant access to customers table
-- ==============================================

-- Drop the overly permissive merchant SELECT policy
DROP POLICY IF EXISTS "Merchants can view all customers" ON public.customers;

-- Create a scoped merchant SELECT policy: merchants can only see customers
-- related to their own live events via orders, live_carts, or live_customers
CREATE POLICY "Merchants can view related customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'merchant'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.live_events le
      WHERE le.user_id = auth.uid()
      AND (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = customers.id AND o.live_event_id = le.id)
        OR EXISTS (SELECT 1 FROM public.live_carts lc JOIN public.live_customers lcust ON lcust.id = lc.live_customer_id WHERE lcust.client_id = customers.id AND lc.live_event_id = le.id)
        OR EXISTS (SELECT 1 FROM public.live_customers lcust2 WHERE lcust2.client_id = customers.id AND lcust2.live_event_id = le.id)
      )
    )
    -- Also allow merchant to see customers from their catalog orders (non-live orders)
    OR (
      public.has_role(auth.uid(), 'merchant'::app_role)
      AND EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = customers.id AND o.live_event_id IS NULL)
    )
  )
);
