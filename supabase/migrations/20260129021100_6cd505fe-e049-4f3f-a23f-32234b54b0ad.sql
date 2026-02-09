-- Create enum for pendencia types
CREATE TYPE public.pendencia_type AS ENUM (
  'observacao_cliente',
  'ajuste_tamanho', 
  'troca',
  'enviar_opcoes',
  'outros'
);

-- Create enum for pendencia status
CREATE TYPE public.pendencia_status AS ENUM (
  'aberta',
  'em_andamento', 
  'resolvida'
);

-- Create enum for pendencia priority
CREATE TYPE public.pendencia_priority AS ENUM (
  'baixa',
  'media',
  'alta'
);

-- Create the live_pendencias table
CREATE TABLE public.live_pendencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_cart_id UUID REFERENCES public.live_carts(id) ON DELETE SET NULL,
  live_event_id UUID REFERENCES public.live_events(id) ON DELETE SET NULL,
  live_customer_id UUID REFERENCES public.live_customers(id) ON DELETE SET NULL,
  type public.pendencia_type NOT NULL DEFAULT 'observacao_cliente',
  title TEXT NOT NULL,
  description TEXT,
  status public.pendencia_status NOT NULL DEFAULT 'aberta',
  priority public.pendencia_priority NOT NULL DEFAULT 'media',
  due_date DATE,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.live_pendencias ENABLE ROW LEVEL SECURITY;

-- RLS Policy for merchants
CREATE POLICY "Merchants can manage pendencias" 
ON public.live_pendencias 
FOR ALL 
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_live_pendencias_updated_at
BEFORE UPDATE ON public.live_pendencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_live_pendencias_status ON public.live_pendencias(status);
CREATE INDEX idx_live_pendencias_live_cart_id ON public.live_pendencias(live_cart_id);
CREATE INDEX idx_live_pendencias_live_event_id ON public.live_pendencias(live_event_id);