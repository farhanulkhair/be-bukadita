-- Migration: Add Missing Columns to Existing Progress Tables
-- Description: ALTER existing tables to add missing columns (module_id, is_completed, etc)
-- Created: 2025-10-16

-- ========================================
-- Add missing columns to user_poin_progress
-- ========================================
DO $$ 
BEGIN
    -- Add module_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_poin_progress' 
        AND column_name = 'module_id'
    ) THEN
        ALTER TABLE public.user_poin_progress 
        ADD COLUMN module_id integer;
        
        COMMENT ON COLUMN public.user_poin_progress.module_id IS 'Frontend module ID (1-5) for grouping';
    END IF;

    -- Add materi_id if not exists (alias for sub_materi_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_poin_progress' 
        AND column_name = 'materi_id'
    ) THEN
        ALTER TABLE public.user_poin_progress 
        ADD COLUMN materi_id text;
        
        COMMENT ON COLUMN public.user_poin_progress.materi_id IS 'Frontend sub-materi ID for grouping';
    END IF;
END $$;

-- ========================================
-- Add missing columns to user_sub_materi_progress
-- ========================================
DO $$ 
BEGIN
    -- Add module_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_sub_materi_progress' 
        AND column_name = 'module_id'
    ) THEN
        ALTER TABLE public.user_sub_materi_progress 
        ADD COLUMN module_id integer;
        
        COMMENT ON COLUMN public.user_sub_materi_progress.module_id IS 'Frontend module ID (1-5) for grouping';
    END IF;

    -- Add progress_percentage if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_sub_materi_progress' 
        AND column_name = 'progress_percentage'
    ) THEN
        ALTER TABLE public.user_sub_materi_progress 
        ADD COLUMN progress_percentage numeric DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
    END IF;
END $$;

-- ========================================
-- Add indexes for new columns
-- ========================================
CREATE INDEX IF NOT EXISTS idx_user_poin_progress_materi ON public.user_poin_progress (materi_id);
CREATE INDEX IF NOT EXISTS idx_user_poin_progress_module ON public.user_poin_progress (module_id);
CREATE INDEX IF NOT EXISTS idx_user_sub_materi_progress_module ON public.user_sub_materi_progress (module_id);

-- ========================================
-- Migration Complete
-- ========================================
-- Tables already exist, we just added missing columns:
-- - user_poin_progress: added module_id, materi_id
-- - user_sub_materi_progress: added module_id, progress_percentage
-- 
-- Run this migration in Supabase SQL Editor


-- ========================================
-- Comments for Documentation
-- ========================================
COMMENT ON TABLE public.user_module_progress IS 'Tracks user progress at module level (module_id 1-5 from frontend)';
COMMENT ON TABLE public.user_sub_materi_progress IS 'Tracks user progress at sub-materi level (sub_materi_id from frontend)';
COMMENT ON TABLE public.user_poin_progress IS 'Tracks user progress at poin level (poin_id from frontend)';

COMMENT ON COLUMN public.user_module_progress.module_id IS 'Frontend module ID (1-5), NOT a foreign key';
COMMENT ON COLUMN public.user_sub_materi_progress.sub_materi_id IS 'Frontend sub-materi ID (sub1, sub2, etc), NOT a foreign key';
COMMENT ON COLUMN public.user_sub_materi_progress.module_id IS 'Frontend module ID for grouping';
COMMENT ON COLUMN public.user_poin_progress.poin_id IS 'Frontend poin ID (poin1-1, etc), NOT a foreign key';
COMMENT ON COLUMN public.user_poin_progress.materi_id IS 'Frontend sub-materi ID for grouping';
COMMENT ON COLUMN public.user_poin_progress.module_id IS 'Frontend module ID for grouping';

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================
-- Enable RLS
ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sub_materi_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_poin_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own progress
CREATE POLICY user_module_progress_select_own 
  ON public.user_module_progress FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY user_sub_materi_progress_select_own 
  ON public.user_sub_materi_progress FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY user_poin_progress_select_own 
  ON public.user_poin_progress FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own progress
CREATE POLICY user_module_progress_insert_own 
  ON public.user_module_progress FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_sub_materi_progress_insert_own 
  ON public.user_sub_materi_progress FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_poin_progress_insert_own 
  ON public.user_poin_progress FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own progress
CREATE POLICY user_module_progress_update_own 
  ON public.user_module_progress FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY user_sub_materi_progress_update_own 
  ON public.user_sub_materi_progress FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY user_poin_progress_update_own 
  ON public.user_poin_progress FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own progress
CREATE POLICY user_module_progress_delete_own 
  ON public.user_module_progress FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY user_sub_materi_progress_delete_own 
  ON public.user_sub_materi_progress FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY user_poin_progress_delete_own 
  ON public.user_poin_progress FOR DELETE 
  USING (auth.uid() = user_id);

-- ========================================
-- Triggers for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all progress tables
CREATE TRIGGER update_user_module_progress_updated_at 
  BEFORE UPDATE ON public.user_module_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sub_materi_progress_updated_at 
  BEFORE UPDATE ON public.user_sub_materi_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_poin_progress_updated_at 
  BEFORE UPDATE ON public.user_poin_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Grant Permissions
-- ========================================
-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sub_materi_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_poin_progress TO authenticated;

-- ========================================
-- Migration Complete
-- ========================================
-- Note: These tables track progress only, NOT content
-- Content (modules, sub-materis, poins) is managed in frontend
-- Backend only stores user progress data
