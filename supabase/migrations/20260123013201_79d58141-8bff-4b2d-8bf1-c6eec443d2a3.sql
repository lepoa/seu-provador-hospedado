-- Create role enum
CREATE TYPE public.app_role AS ENUM ('customer', 'merchant', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy: users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Add user_id to orders table for customer ownership
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id to print_requests for customer ownership  
ALTER TABLE public.print_requests ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update orders RLS policies
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;

CREATE POLICY "Customers can create their own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can update orders"
ON public.orders FOR UPDATE
USING (public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));

-- Update print_requests RLS policies
DROP POLICY IF EXISTS "Anyone can create print requests" ON public.print_requests;
DROP POLICY IF EXISTS "Anyone can view print requests" ON public.print_requests;

CREATE POLICY "Customers can create their own print requests"
ON public.print_requests FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Customers can view their own print requests"
ON public.print_requests FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'merchant') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can update their own print requests"
ON public.print_requests FOR UPDATE
USING (auth.uid() = user_id);

-- Update profiles to include customer data
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_sizes TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS style_preferences TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Function to auto-create customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign customer role
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();