
-- =============================================
-- FIX 1: customers & customer_addresses RLS
-- =============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Merchants can view related customers" ON public.customers;
DROP POLICY IF EXISTS "Merchants can update customers" ON public.customers;
DROP POLICY IF EXISTS "Merchants can manage customer addresses" ON public.customer_addresses;

-- Merchant SELECT: only customers related to their own live_events
CREATE POLICY "Merchants can view related customers" ON public.customers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'merchant'::app_role) AND EXISTS (
      SELECT 1 FROM public.live_events le
      WHERE le.user_id = auth.uid()
      AND (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = customers.id AND o.live_event_id = le.id)
        OR EXISTS (SELECT 1 FROM public.live_customers lcust WHERE lcust.client_id = customers.id AND lcust.live_event_id = le.id)
      )
    )
  )
);

-- Merchant UPDATE: only customers related to their own live_events (same scope)
CREATE POLICY "Merchants can update related customers" ON public.customers
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'merchant'::app_role) AND EXISTS (
      SELECT 1 FROM public.live_events le
      WHERE le.user_id = auth.uid()
      AND (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = customers.id AND o.live_event_id = le.id)
        OR EXISTS (SELECT 1 FROM public.live_customers lcust WHERE lcust.client_id = customers.id AND lcust.live_event_id = le.id)
      )
    )
  )
);

-- customer_addresses: scope merchant access to only addresses of customers they can see
CREATE POLICY "Merchants can view related customer addresses" ON public.customer_addresses
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'merchant'::app_role) AND EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.live_events le ON le.user_id = auth.uid()
      WHERE c.id = customer_addresses.customer_id
      AND (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id AND o.live_event_id = le.id)
        OR EXISTS (SELECT 1 FROM public.live_customers lcust WHERE lcust.client_id = c.id AND lcust.live_event_id = le.id)
      )
    )
  )
);

CREATE POLICY "Merchants can update related customer addresses" ON public.customer_addresses
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'merchant'::app_role) AND EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.live_events le ON le.user_id = auth.uid()
      WHERE c.id = customer_addresses.customer_id
      AND (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id AND o.live_event_id = le.id)
        OR EXISTS (SELECT 1 FROM public.live_customers lcust WHERE lcust.client_id = c.id AND lcust.live_event_id = le.id)
      )
    )
  )
);

CREATE POLICY "Merchants can insert customer addresses" ON public.customer_addresses
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'merchant'::app_role)
);

-- =============================================
-- FIX 3: prints storage bucket - restrict uploads
-- =============================================

DROP POLICY IF EXISTS "Anyone can upload prints" ON storage.objects;

CREATE POLICY "Authenticated users can upload prints" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prints'
  AND auth.role() = 'authenticated'
);
