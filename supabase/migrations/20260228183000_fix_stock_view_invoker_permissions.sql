-- Fix: avoid leaking orders RLS errors into product stock view consumers.
-- Context: product admin reads product_available_stock; in some environments
-- the view runs as security_invoker and ends up requiring direct access to
-- orders/order_items internals.
--
-- We keep orders protected by their own RLS and only expose aggregated stock
-- through the stock views.

ALTER VIEW IF EXISTS public.product_available_stock
  SET (security_invoker = off);

ALTER VIEW IF EXISTS public.public_product_stock
  SET (security_invoker = off);

GRANT SELECT ON public.product_available_stock TO authenticated;
GRANT SELECT ON public.public_product_stock TO anon, authenticated;
