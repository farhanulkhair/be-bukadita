-- Migration: Create Simple Quiz Tables (Compatible with Frontend ID System)
-- Date: 2025-10-16
-- Description: Create quiz tables using INTEGER module_id and TEXT sub_materi_id
--              to match frontend static data and _simple progress tables

-- ============================================================================
-- 1. Create user_quiz_attempts_simple table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_quiz_attempts_simple (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id integer NOT NULL,           -- Frontend module ID (1, 2, 3, 4, 5)
  sub_materi_id text NOT NULL,          -- Frontend sub-materi ID ('sub1', 'sub2', 'sub3')
  quiz_data jsonb NOT NULL,             -- Store entire quiz data from frontend
  score numeric(5, 2) NOT NULL DEFAULT 0,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL DEFAULT 0,
  answers jsonb,                        -- User answers: [{ question_id, selected_option_index, is_correct }]
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  is_passed boolean DEFAULT false,
  time_taken_seconds integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT user_quiz_attempts_simple_pkey PRIMARY KEY (id),
  CONSTRAINT user_quiz_attempts_simple_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_quiz_attempts_simple_score_check CHECK (
    (score >= 0 AND score <= 100)
  )
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_simple_user 
  ON public.user_quiz_attempts_simple USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_simple_module 
  ON public.user_quiz_attempts_simple USING btree (module_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_simple_sub_materi 
  ON public.user_quiz_attempts_simple USING btree (sub_materi_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_simple_user_sub 
  ON public.user_quiz_attempts_simple USING btree (user_id, sub_materi_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_simple_completed 
  ON public.user_quiz_attempts_simple USING btree (user_id, completed_at) TABLESPACE pg_default;

-- ============================================================================
-- 2. Enable Row Level Security
-- ============================================================================
ALTER TABLE public.user_quiz_attempts_simple ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Create RLS Policies
-- ============================================================================

-- Policy: Users can view their own quiz attempts
CREATE POLICY "Users can view own quiz attempts"
  ON public.user_quiz_attempts_simple
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own quiz attempts
CREATE POLICY "Users can insert own quiz attempts"
  ON public.user_quiz_attempts_simple
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own quiz attempts
CREATE POLICY "Users can update own quiz attempts"
  ON public.user_quiz_attempts_simple
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. Add Comments for Documentation
-- ============================================================================
COMMENT ON TABLE public.user_quiz_attempts_simple IS 
  'Simple quiz attempts tracking using frontend string/integer IDs (no foreign keys to quiz tables)';

COMMENT ON COLUMN public.user_quiz_attempts_simple.module_id IS 
  'Frontend module ID integer (1-5)';

COMMENT ON COLUMN public.user_quiz_attempts_simple.sub_materi_id IS 
  'Frontend sub-materi ID string (e.g., sub1, sub2)';

COMMENT ON COLUMN public.user_quiz_attempts_simple.quiz_data IS 
  'Full quiz data from frontend including questions, options, correct answers';

COMMENT ON COLUMN public.user_quiz_attempts_simple.answers IS 
  'User answers array: [{ question_id, selected_option_index, is_correct }]';
