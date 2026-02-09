-- Create discount type enum
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

-- Add discount fields to product_catalog
ALTER TABLE public.product_catalog
ADD COLUMN discount_type public.discount_type DEFAULT NULL,
ADD COLUMN discount_value numeric DEFAULT NULL;

-- Add live-specific discount fields to live_products
ALTER TABLE public.live_products
ADD COLUMN live_discount_type public.discount_type DEFAULT NULL,
ADD COLUMN live_discount_value numeric DEFAULT NULL;

-- Create coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type public.discount_type NOT NULL,
  discount_value numeric NOT NULL,
  starts_at timestamp with time zone DEFAULT NULL,
  ends_at timestamp with time zone DEFAULT NULL,
  max_uses integer DEFAULT NULL,
  times_used integer NOT NULL DEFAULT 0,
  min_order_value numeric DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  user_id uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupons
CREATE POLICY "Merchants can manage coupons"
ON public.coupons
FOR ALL
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active coupons"
ON public.coupons
FOR SELECT
USING (is_active = true);

-- Create coupon_uses table for tracking
CREATE TABLE public.coupon_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  live_cart_id uuid REFERENCES public.live_carts(id) ON DELETE SET NULL,
  discount_applied numeric NOT NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on coupon_uses
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

-- RLS policies for coupon_uses
CREATE POLICY "Merchants can view coupon uses"
ON public.coupon_uses
FOR SELECT
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert coupon uses"
ON public.coupon_uses
FOR INSERT
WITH CHECK (true);

-- Add coupon reference to orders
ALTER TABLE public.orders
ADD COLUMN coupon_id uuid REFERENCES public.coupons(id) DEFAULT NULL,
ADD COLUMN coupon_discount numeric DEFAULT 0;

-- Add coupon reference to live_carts
ALTER TABLE public.live_carts
ADD COLUMN coupon_id uuid REFERENCES public.coupons(id) DEFAULT NULL,
ADD COLUMN coupon_discount numeric DEFAULT 0;

-- Create trigger for updated_at on coupons
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();