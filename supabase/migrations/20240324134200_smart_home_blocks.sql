-- Smart Home Blocks Migration

-- 1. Function to get weekly trending products
CREATE OR REPLACE FUNCTION public.get_weekly_trending_products()
RETURNS TABLE (
    product_id UUID,
    name TEXT,
    price NUMERIC,
    image_url TEXT,
    images TEXT[],
    main_image_index INTEGER,
    quantity_sold BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id as product_id,
        pc.name,
        pc.price,
        pc.image_url,
        pc.images,
        pc.main_image_index,
        COALESCE(SUM(oi.quantity), 0)::BIGINT as quantity_sold
    FROM 
        public.order_items oi
    JOIN 
        public.orders o ON oi.order_id = o.id
    JOIN 
        public.product_catalog pc ON oi.product_id = pc.id
    WHERE 
        o.status = 'pago' 
        AND o.created_at >= NOW() - INTERVAL '7 days'
        AND pc.is_active = true
    GROUP BY 
        pc.id, pc.name, pc.price, pc.image_url, pc.images, pc.main_image_index
    ORDER BY 
        quantity_sold DESC
    LIMIT 6;
END;
$$;

-- 2. AI Look Sessions Table
CREATE TABLE IF NOT EXISTS public.ai_look_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    input_text TEXT NOT NULL,
    generated_title TEXT,
    generated_description TEXT,
    generated_product_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_look_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for ai_look_sessions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own AI look sessions') THEN
        CREATE POLICY "Users can view own AI look sessions" ON public.ai_look_sessions
            FOR SELECT USING (auth.uid() = user_id OR session_id = auth.uid()::text);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own AI look sessions') THEN
        CREATE POLICY "Users can insert own AI look sessions" ON public.ai_look_sessions
            FOR INSERT WITH CHECK (auth.uid() = user_id OR true);
    END IF;
END $$;

-- 3. Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies for analytics_events
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert analytics events') THEN
        CREATE POLICY "Anyone can insert analytics events" ON public.analytics_events
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_weekly_trending_products() TO anon, authenticated;
GRANT ALL ON public.ai_look_sessions TO authenticated, anon;
GRANT ALL ON public.analytics_events TO authenticated, anon;
