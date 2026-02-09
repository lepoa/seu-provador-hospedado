-- Add missions tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS completed_missions text[] DEFAULT '{}';

-- Create missions_log table to track individual mission completions
CREATE TABLE IF NOT EXISTS public.missions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  points_earned integer NOT NULL DEFAULT 100,
  answers jsonb DEFAULT '[]',
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

-- Enable RLS
ALTER TABLE public.missions_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own mission logs
CREATE POLICY "Users can view own missions"
  ON public.missions_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own mission logs
CREATE POLICY "Users can insert own missions"
  ON public.missions_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Merchants can view all mission logs
CREATE POLICY "Merchants can view all missions"
  ON public.missions_log
  FOR SELECT
  USING (has_role(auth.uid(), 'merchant') OR has_role(auth.uid(), 'admin'));