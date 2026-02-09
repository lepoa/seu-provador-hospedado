-- Fix overly permissive RLS policies on customers table
DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;

-- Customers table policies - merchants can manage, customers can view their own
CREATE POLICY "Anyone can create customers for quiz"
ON public.customers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Merchants can view all customers"
ON public.customers FOR SELECT
USING (public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can update customers"
ON public.customers FOR UPDATE
USING (public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));

-- Fix order_items policies
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

CREATE POLICY "Users can create order items for their orders"
ON public.order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_id 
    AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
  )
);

CREATE POLICY "Users can view their order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_id 
    AND (orders.user_id = auth.uid() OR public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Fix quiz_responses policies (keep public for quiz flow but restrict viewing)
DROP POLICY IF EXISTS "Anyone can create quiz responses" ON public.quiz_responses;
DROP POLICY IF EXISTS "Anyone can view quiz responses" ON public.quiz_responses;

CREATE POLICY "Anyone can create quiz responses"
ON public.quiz_responses FOR INSERT
WITH CHECK (true);

CREATE POLICY "Merchants can view quiz responses"
ON public.quiz_responses FOR SELECT
USING (public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));

-- Fix recommendations policies
DROP POLICY IF EXISTS "Anyone can create recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Anyone can view recommendations" ON public.recommendations;

CREATE POLICY "System can create recommendations"
ON public.recommendations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Merchants can view recommendations"
ON public.recommendations FOR SELECT
USING (public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));