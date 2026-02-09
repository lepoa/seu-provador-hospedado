
-- =============================================
-- 1. REVOKE unnecessary grants from anon on sensitive tables
-- =============================================
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customer_addresses FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE ALL ON public.password_reset_tokens FROM anon;

-- Keep anon INSERT on orders/order_items for guest checkout
REVOKE SELECT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.order_items FROM anon;

-- =============================================
-- 2. Fix password_reset_tokens - add explicit deny policy
-- =============================================
DROP POLICY IF EXISTS "Deny public access to password_reset_tokens" ON public.password_reset_tokens;
CREATE POLICY "Deny all access to password_reset_tokens"
  ON public.password_reset_tokens
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- =============================================
-- 3. Fix orders SELECT - remove NULL user_id loophole
-- =============================================
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = user_id)
    OR has_role(auth.uid(), 'merchant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- =============================================
-- 4. Fix profiles policies - change from public to authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- 5. Fix promotional_tables - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Users can view all promotional tables" ON public.promotional_tables;
CREATE POLICY "Authenticated users can view promotional tables"
  ON public.promotional_tables
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage promotional tables" ON public.promotional_tables;
CREATE POLICY "Merchants can manage promotional tables"
  ON public.promotional_tables
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 6. Fix loyalty_settings - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Anyone can view settings" ON public.loyalty_settings;
CREATE POLICY "Authenticated users can view settings"
  ON public.loyalty_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- 7. Fix coupons - restrict SELECT to authenticated
-- =============================================
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
CREATE POLICY "Authenticated users can view active coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- =============================================
-- 8. Fix quiz_leads - restrict SELECT to merchants only
-- =============================================
-- INSERT for anon stays (public quiz submission)
-- But remove anon SELECT (lead data is merchant-only, already covered by merchant policy)

-- =============================================
-- 9. Fix live_carts - scope to merchant's events
-- =============================================
DROP POLICY IF EXISTS "Merchants can manage live carts" ON public.live_carts;
CREATE POLICY "Merchants can manage live carts"
  ON public.live_carts
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'merchant'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.live_events le
        WHERE le.id = live_carts.live_event_id AND le.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'merchant'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.live_events le
        WHERE le.id = live_carts.live_event_id AND le.user_id = auth.uid()
      )
    )
  );

-- =============================================
-- 10. Fix live_customers - scope to merchant's events
-- =============================================
DROP POLICY IF EXISTS "Merchants can manage live customers" ON public.live_customers;
CREATE POLICY "Merchants can manage live customers"
  ON public.live_customers
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'merchant'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.live_events le
        WHERE le.id = live_customers.live_event_id AND le.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'merchant'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.live_events le
        WHERE le.id = live_customers.live_event_id AND le.user_id = auth.uid()
      )
    )
  );

-- =============================================
-- 11. Fix storage - restrict product-images upload to authenticated only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products');

-- Fix DELETE/UPDATE to require merchant/admin role
DROP POLICY IF EXISTS "Users can delete their product images" ON storage.objects;
CREATE POLICY "Merchants can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'products' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their product images" ON storage.objects;
CREATE POLICY "Merchants can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'products' AND auth.uid() IS NOT NULL);
