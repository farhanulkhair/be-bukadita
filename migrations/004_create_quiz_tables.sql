-- Migration: Create Quiz Tables with Published Field
-- Date: 2025-10-07

-- Create materis_quizzes table
CREATE TABLE IF NOT EXISTS public.materis_quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  sub_materi_id uuid NOT NULL,
  quiz_type text DEFAULT 'sub'::text,
  title text NOT NULL,
  description text,
  time_limit_seconds integer DEFAULT 600,
  passing_score integer DEFAULT 70,
  published boolean DEFAULT false, -- New field untuk publish/draft
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  
  CONSTRAINT materis_quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_quiz_module FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_sub FOREIGN KEY (sub_materi_id) REFERENCES sub_materis (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_quiz_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT materis_quizzes_passing_score_check CHECK (
    (passing_score >= 0 AND passing_score <= 100)
  ),
  CONSTRAINT materis_quizzes_time_limit_seconds_check CHECK (time_limit_seconds > 0)
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_module ON public.materis_quizzes USING btree (module_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quiz_sub ON public.materis_quizzes USING btree (sub_materi_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quiz_published ON public.materis_quizzes USING btree (published) TABLESPACE pg_default;

-- Create materis_quiz_questions table
CREATE TABLE IF NOT EXISTS public.materis_quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL, -- Array of options: ["Option A", "Option B", "Option C", "Option D"]
  correct_answer_index integer NOT NULL, -- Index of correct answer (0-based)
  explanation text, -- Optional explanation
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT materis_quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT materis_quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES materis_quizzes (id) ON DELETE CASCADE,
  CONSTRAINT valid_correct_answer_index CHECK (correct_answer_index >= 0 AND correct_answer_index <= 3)
) TABLESPACE pg_default;

-- Create index for quiz questions
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.materis_quiz_questions USING btree (quiz_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.materis_quiz_questions USING btree (quiz_id, order_index) TABLESPACE pg_default;

-- Create user quiz attempts table (for tracking user progress)
CREATE TABLE IF NOT EXISTS public.user_quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL DEFAULT 0,
  answers jsonb, -- Store user answers: {"question_id": selected_index}
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  is_passed boolean DEFAULT false,
  time_taken_seconds integer,
  
  CONSTRAINT user_quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES materis_quizzes (id) ON DELETE CASCADE,
  CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100)
) TABLESPACE pg_default;

-- Create indexes for user attempts
CREATE INDEX IF NOT EXISTS idx_attempts_user ON public.user_quiz_attempts USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON public.user_quiz_attempts USING btree (quiz_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_attempts_user_quiz ON public.user_quiz_attempts USING btree (user_id, quiz_id) TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON TABLE public.materis_quizzes IS 'Table to store quiz metadata and settings';
COMMENT ON COLUMN public.materis_quizzes.published IS 'Whether quiz is published (true) or draft (false)';
COMMENT ON COLUMN public.materis_quizzes.quiz_type IS 'Type of quiz: sub (for sub_materi) or module (for whole module)';

COMMENT ON TABLE public.materis_quiz_questions IS 'Table to store quiz questions with multiple choice options';
COMMENT ON COLUMN public.materis_quiz_questions.options IS 'JSON array of answer options';
COMMENT ON COLUMN public.materis_quiz_questions.correct_answer_index IS '0-based index of correct answer in options array';

COMMENT ON TABLE public.user_quiz_attempts IS 'Table to track user quiz attempts and scores';