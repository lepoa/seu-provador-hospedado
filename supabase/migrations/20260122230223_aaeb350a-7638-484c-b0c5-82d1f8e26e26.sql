-- Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT,
  size TEXT,
  style_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quiz responses table
CREATE TABLE public.quiz_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product catalog table
CREATE TABLE public.product_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  sizes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Print requests table (for story screenshots)
CREATE TABLE public.print_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  size TEXT,
  preference TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recommendations table
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  products UUID[] DEFAULT '{}',
  look_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table for store owners (lojistas)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  store_name TEXT,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public policies for customers (anyone can create, only authenticated can view all)
CREATE POLICY "Anyone can create customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Anyone can update customers" ON public.customers FOR UPDATE USING (true);

-- Public policies for quiz_responses
CREATE POLICY "Anyone can create quiz responses" ON public.quiz_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view quiz responses" ON public.quiz_responses FOR SELECT USING (true);

-- Public policies for product_catalog (public read, authenticated write)
CREATE POLICY "Anyone can view products" ON public.product_catalog FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage products" ON public.product_catalog FOR ALL USING (auth.uid() IS NOT NULL);

-- Public policies for print_requests
CREATE POLICY "Anyone can create print requests" ON public.print_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view print requests" ON public.print_requests FOR SELECT USING (true);

-- Public policies for recommendations
CREATE POLICY "Anyone can create recommendations" ON public.recommendations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view recommendations" ON public.recommendations FOR SELECT USING (true);

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create storage bucket for story prints
INSERT INTO storage.buckets (id, name, public) VALUES ('prints', 'prints', true);

-- Storage policies
CREATE POLICY "Anyone can upload prints" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prints');
CREATE POLICY "Anyone can view prints" ON storage.objects FOR SELECT USING (bucket_id = 'prints');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample products
INSERT INTO public.product_catalog (name, price, image_url, tags, category, sizes) VALUES
('Vestido Midi Floral', 289.90, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400', ARRAY['elegante', 'romântico', 'floral'], 'vestidos', ARRAY['P', 'M', 'G']),
('Blazer Alfaiataria', 399.90, 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400', ARRAY['clássico', 'trabalho', 'minimal'], 'blazers', ARRAY['P', 'M', 'G', 'GG']),
('Calça Wide Leg', 259.90, 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400', ARRAY['moderno', 'confortável', 'versátil'], 'calças', ARRAY['36', '38', '40', '42', '44']),
('Blusa Seda Premium', 189.90, 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400', ARRAY['elegante', 'luxo', 'básico'], 'blusas', ARRAY['P', 'M', 'G']),
('Saia Lápis Clássica', 199.90, 'https://images.unsplash.com/photo-1583496661160-fb5886a0uj1?w=400', ARRAY['clássico', 'trabalho', 'elegante'], 'saias', ARRAY['P', 'M', 'G', 'GG']),
('Conjunto Alfaiataria', 549.90, 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=400', ARRAY['power', 'trabalho', 'elegante'], 'conjuntos', ARRAY['P', 'M', 'G']);
