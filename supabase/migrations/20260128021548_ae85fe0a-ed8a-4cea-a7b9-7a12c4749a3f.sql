-- Create table for AI business insights
CREATE TABLE public.ai_business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_date DATE NOT NULL DEFAULT CURRENT_DATE,
  analysis_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  analysis_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  details_clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, insight_date)
);

-- Enable RLS
ALTER TABLE public.ai_business_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Merchants can view own insights"
ON public.ai_business_insights
FOR SELECT
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert insights"
ON public.ai_business_insights
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Merchants can update own insights"
ON public.ai_business_insights
FOR UPDATE
USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));

-- Updated at trigger
CREATE TRIGGER update_ai_business_insights_updated_at
BEFORE UPDATE ON public.ai_business_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast daily lookups
CREATE INDEX idx_ai_business_insights_date ON public.ai_business_insights(insight_date DESC);