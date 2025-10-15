-- Migration: Add Missing Columns to Existing Progress Tables
-- Description: ALTER existing tables to add missing columns (module_id, sub_materi_id, progress_percentage)
-- Created: 2025-10-16
-- 
-- IMPORTANT: Tables already exist in database, we just need to ADD missing columns

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
        
        RAISE NOTICE 'Added module_id column to user_poin_progress';
    ELSE
        RAISE NOTICE 'Column module_id already exists in user_poin_progress';
    END IF;

    -- Add sub_materi_id if not exists (for sub_materi grouping)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_poin_progress' 
        AND column_name = 'sub_materi_id'
    ) THEN
        ALTER TABLE public.user_poin_progress 
        ADD COLUMN sub_materi_id text;
        
        RAISE NOTICE 'Added sub_materi_id column to user_poin_progress';
    ELSE
        RAISE NOTICE 'Column sub_materi_id already exists in user_poin_progress';
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
        
        RAISE NOTICE 'Added module_id column to user_sub_materi_progress';
    ELSE
        RAISE NOTICE 'Column module_id already exists in user_sub_materi_progress';
    END IF;

    -- Add progress_percentage if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_sub_materi_progress' 
        AND column_name = 'progress_percentage'
    ) THEN
        ALTER TABLE public.user_sub_materi_progress 
        ADD COLUMN progress_percentage numeric DEFAULT 0;
        
        -- Add constraint
        ALTER TABLE public.user_sub_materi_progress 
        ADD CONSTRAINT check_progress_percentage 
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
        
        RAISE NOTICE 'Added progress_percentage column to user_sub_materi_progress';
    ELSE
        RAISE NOTICE 'Column progress_percentage already exists in user_sub_materi_progress';
    END IF;
END $$;

-- ========================================
-- Add indexes for new columns (IF NOT EXISTS)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_user_poin_progress_sub_materi 
  ON public.user_poin_progress (sub_materi_id);

CREATE INDEX IF NOT EXISTS idx_user_poin_progress_module 
  ON public.user_poin_progress (module_id);

CREATE INDEX IF NOT EXISTS idx_user_sub_materi_progress_module 
  ON public.user_sub_materi_progress (module_id);

-- ========================================
-- Add comments for documentation
-- ========================================
COMMENT ON COLUMN public.user_poin_progress.module_id IS 'Frontend module ID (1-5) for grouping - NOT a foreign key';
COMMENT ON COLUMN public.user_poin_progress.sub_materi_id IS 'Frontend sub-materi ID (sub1, sub2, etc) for grouping - NOT a foreign key';
COMMENT ON COLUMN public.user_sub_materi_progress.module_id IS 'Frontend module ID (1-5) for grouping - NOT a foreign key';
COMMENT ON COLUMN public.user_sub_materi_progress.progress_percentage IS 'Percentage of completion (0-100)';

-- ========================================
-- Verification Query (Optional)
-- ========================================
-- Run this to verify columns were added successfully:
-- 
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
-- AND table_name IN ('user_poin_progress', 'user_sub_materi_progress', 'user_module_progress')
-- ORDER BY table_name, ordinal_position;

-- ========================================
-- Migration Complete!
-- ========================================
-- What was added:
-- 1. user_poin_progress: module_id (integer), sub_materi_id (text)
-- 2. user_sub_materi_progress: module_id (integer), progress_percentage (numeric 0-100)
-- 3. Indexes for performance
-- 4. Documentation comments
-- 
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy paste this entire file
-- 3. Click Run (or Ctrl+Enter)
-- 4. Check output for success messages
-- 5. Restart backend server: npm run start
