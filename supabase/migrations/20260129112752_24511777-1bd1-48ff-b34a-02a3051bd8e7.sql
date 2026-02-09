-- Create promotional_tables for price rules with scheduling
CREATE TABLE public.promotional_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Scheduling
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  
  -- Store-wide discount
  store_discount_type TEXT CHECK (store_discount_type IN ('percentage', 'fixed')),
  store_discount_value NUMERIC,
  store_min_order_value NUMERIC DEFAULT 0,
  
  -- Category discounts (JSONB array)
  -- Format: [{"category": "vestidos", "discount_type": "percentage", "discount_value": 10}]
  category_discounts JSONB DEFAULT '[]'::jsonb,
  
  -- Product discounts (JSONB array)
  -- Format: [{"product_id": "uuid", "discount_type": "percentage", "discount_value": 15}]
  product_discounts JSONB DEFAULT '[]'::jsonb,
  
  -- Channel scope
  channel_scope TEXT NOT NULL DEFAULT 'all' CHECK (channel_scope IN ('all', 'catalog', 'live')),
  
  -- Metadata
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotional_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all promotional tables"
  ON public.promotional_tables FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage promotional tables"
  ON public.promotional_tables FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_promotional_tables_updated_at
  BEFORE UPDATE ON public.promotional_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for active tables lookup
CREATE INDEX idx_promotional_tables_active ON public.promotional_tables (is_active, start_at, end_at);
CREATE INDEX idx_promotional_tables_priority ON public.promotional_tables (priority DESC);