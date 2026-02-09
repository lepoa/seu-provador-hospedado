-- Create mission_attempts table for tracking mission progress with photos
CREATE TABLE public.mission_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  answers_json JSONB DEFAULT '[]'::jsonb,
  current_question INTEGER NOT NULL DEFAULT 0,
  score_earned INTEGER NOT NULL DEFAULT 0,
  images_urls TEXT[] DEFAULT '{}'::text[],
  analysis_json JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mission_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own mission attempts
CREATE POLICY "Users can view own mission attempts"
  ON public.mission_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own mission attempts
CREATE POLICY "Users can insert own mission attempts"
  ON public.mission_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own mission attempts
CREATE POLICY "Users can update own mission attempts"
  ON public.mission_attempts FOR UPDATE
  USING (auth.uid() = user_id);

-- Merchants can view all mission attempts
CREATE POLICY "Merchants can view all mission attempts"
  ON public.mission_attempts FOR SELECT
  USING (has_role(auth.uid(), 'merchant'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create trigger to update updated_at
CREATE TRIGGER update_mission_attempts_updated_at
  BEFORE UPDATE ON public.mission_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_mission_attempts_user_mission ON public.mission_attempts(user_id, mission_id);
CREATE INDEX idx_mission_attempts_status ON public.mission_attempts(status);

-- Add suggestions_updated_at to profiles for tracking when suggestions were last refreshed
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS suggestions_updated_at TIMESTAMP WITH TIME ZONE;

-- Add last_mission_completed to profiles for quick access
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_mission_id TEXT,
ADD COLUMN IF NOT EXISTS last_mission_completed_at TIMESTAMP WITH TIME ZONE;