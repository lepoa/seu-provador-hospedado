
-- =====================================================
-- SECURITY HARDENING: Restrict TO PUBLIC → TO authenticated
-- Fix SECURITY DEFINER view: public_product_stock
-- =====================================================

-- 1) Fix public_product_stock view - add security_invoker
ALTER VIEW public.public_product_stock SET (security_invoker = on);

-- =====================================================
-- 2) CUSTOMERS table - restrict roles
-- =====================================================

-- Drop and recreate policies that use {public} roles
DROP POLICY IF EXISTS "Merchants can view all customers" ON public.customers;
CREATE POLICY "Merchants can view all customers" ON public.customers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Merchants can update customers" ON public.customers;
CREATE POLICY "Merchants can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own customer record" ON public.customers;
CREATE POLICY "Users can view their own customer record" ON public.customers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 3) CUSTOMER_ADDRESSES - restrict roles
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.customer_addresses;
CREATE POLICY "Users can manage their own addresses" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_addresses.customer_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_addresses.customer_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Merchants can manage customer addresses" ON public.customer_addresses;
CREATE POLICY "Merchants can manage customer addresses" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 4) ORDERS - restrict SELECT/UPDATE to authenticated, keep INSERT for checkout
-- =====================================================

DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Merchants can update orders" ON public.orders;
CREATE POLICY "Merchants can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- INSERT: keep anon+authenticated for guest checkout
DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
CREATE POLICY "Customers can create their own orders" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- =====================================================
-- 5) ORDER_ITEMS - restrict SELECT to authenticated, keep INSERT for checkout
-- =====================================================

DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
CREATE POLICY "Users can view their order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
CREATE POLICY "Users can create order items for their orders" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
  ));

-- =====================================================
-- 6) PAYMENTS - restrict to authenticated
-- =====================================================

DROP POLICY IF EXISTS "System can manage payments" ON public.payments;
CREATE POLICY "Merchants can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payments.order_id
    AND orders.user_id = auth.uid()
  ));

-- =====================================================
-- 7) LIVE_CARTS - restrict merchant to authenticated, add public SELECT for checkout
-- =====================================================

DROP POLICY IF EXISTS "Merchants can manage live carts" ON public.live_carts;
CREATE POLICY "Merchants can manage live carts" ON public.live_carts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Public can view their cart for checkout (only open/pending carts)
CREATE POLICY "Public can view cart for checkout" ON public.live_carts
  FOR SELECT TO anon, authenticated
  USING (status IN ('aberto'::live_cart_status, 'em_confirmacao'::live_cart_status, 'aguardando_pagamento'::live_cart_status));

-- =====================================================
-- 8) LIVE_CART_ITEMS - restrict merchant to authenticated, add public SELECT for checkout
-- =====================================================

DROP POLICY IF EXISTS "Merchants can manage live cart items" ON public.live_cart_items;
CREATE POLICY "Merchants can manage live cart items" ON public.live_cart_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Public can view cart items for checkout
CREATE POLICY "Public can view cart items for checkout" ON public.live_cart_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM live_carts lc
    WHERE lc.id = live_cart_items.live_cart_id
    AND lc.status IN ('aberto'::live_cart_status, 'em_confirmacao'::live_cart_status, 'aguardando_pagamento'::live_cart_status)
  ));

-- =====================================================
-- 9) LIVE_EVENTS - restrict to authenticated
-- =====================================================

DROP POLICY IF EXISTS "Merchants can manage live events" ON public.live_events;
CREATE POLICY "Merchants can manage live events" ON public.live_events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Public can view live events (needed for live checkout page to show event title)
CREATE POLICY "Public can view live events" ON public.live_events
  FOR SELECT TO anon, authenticated
  USING (status IN ('ao_vivo', 'planejada', 'encerrada'));

-- =====================================================
-- 10) LIVE_PRODUCTS - restrict to authenticated
-- =====================================================

DROP POLICY IF EXISTS "Merchants can manage live products" ON public.live_products;
CREATE POLICY "Merchants can manage live products" ON public.live_products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 11) LIVE_CUSTOMERS - restrict to authenticated
-- =====================================================

DROP POLICY IF EXISTS "Merchants can manage live customers" ON public.live_customers;
CREATE POLICY "Merchants can manage live customers" ON public.live_customers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 12) PRODUCT_CATALOG - restrict management to authenticated
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own products" ON public.product_catalog;
CREATE POLICY "Merchants can manage products" ON public.product_catalog
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
