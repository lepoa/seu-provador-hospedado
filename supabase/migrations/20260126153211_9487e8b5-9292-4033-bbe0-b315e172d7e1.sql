-- Add quiz-related fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS size_letter text,
ADD COLUMN IF NOT EXISTS size_number text,
ADD COLUMN IF NOT EXISTS style_title text,
ADD COLUMN IF NOT EXISTS quiz_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quiz_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS quiz_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS style_description text,
ADD COLUMN IF NOT EXISTS color_palette text[],
ADD COLUMN IF NOT EXISTS avoid_items text[],
ADD COLUMN IF NOT EXISTS personal_tip text;

-- Add user_id to quiz_responses for direct user linking
ALTER TABLE public.quiz_responses
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON public.quiz_responses(user_id);

-- Update RLS policy for quiz_responses to allow users to see their own responses
DROP POLICY IF EXISTS "Users can view their own quiz responses" ON public.quiz_responses;
CREATE POLICY "Users can view their own quiz responses"
ON public.quiz_responses
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'merchant'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Update insert policy to allow authenticated users
DROP POLICY IF EXISTS "Anyone can create quiz responses" ON public.quiz_responses;
CREATE POLICY "Authenticated users can create quiz responses"
ON public.quiz_responses
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Link customers table to profiles via user_id for authenticated users
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- Update customers RLS to allow users to see their own customer record
DROP POLICY IF EXISTS "Users can view their own customer record" ON public.customers;
CREATE POLICY "Users can view their own customer record"
ON public.customers
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'merchant'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Allow authenticated users to create/update their own customer record
DROP POLICY IF EXISTS "Users can manage their own customer record" ON public.customers;
CREATE POLICY "Users can manage their own customer record"
ON public.customers
FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);