-- Migration: Remove is_active field from materis_quizzes
-- Date: 2025-10-09
-- Description: Remove unused is_active column that was not in the original schema

-- Drop the is_active column if it exists
ALTER TABLE public.materis_quizzes 
DROP COLUMN IF EXISTS is_active;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_quiz_is_active;