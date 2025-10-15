-- Migration: Create Simple Progress Tables (No Foreign Keys)
-- Description: Create new simple tables that accept frontend string IDs directly
-- Created: 2025-10-16
-- 
-- STRATEGY: Create new simple tables without foreign key constraints
-- Frontend uses static data (poin1-1, sub1, module1, etc) not UUIDs

-- ========================================
-- 1. Create new simple poin progress table
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_poin_progress_simple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Frontend string IDs (no foreign keys)
  module_id integer NOT NULL,           -- 1, 2, 3, 4, 5
  sub_materi_id text NOT NULL,          -- 'sub1', 'sub2', 'sub3'
  poin_id text NOT NULL,                -- 'poin1-1', 'poin1-2', etc
  
  -- Progress tracking
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint: one record per user per poin
  CONSTRAINT uq_user_poin_simple UNIQUE (user_id, poin_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_poin_simple_user 
  ON public.user_poin_progress_simple (user_id);
  
CREATE INDEX IF NOT EXISTS idx_user_poin_simple_module 
  ON public.user_poin_progress_simple (module_id);
  
CREATE INDEX IF NOT EXISTS idx_user_poin_simple_sub_materi 
  ON public.user_poin_progress_simple (sub_materi_id);

CREATE INDEX IF NOT EXISTS idx_user_poin_simple_completed 
  ON public.user_poin_progress_simple (user_id, is_completed);

-- ========================================
-- 2. Create new simple sub-materi progress table
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_sub_materi_progress_simple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Frontend string IDs (no foreign keys)
  module_id integer NOT NULL,           -- 1, 2, 3, 4, 5
  sub_materi_id text NOT NULL,          -- 'sub1', 'sub2', 'sub3'
  
  -- Progress tracking
  is_completed boolean DEFAULT false,
  progress_percentage numeric(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  completed_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint: one record per user per sub-materi
  CONSTRAINT uq_user_sub_materi_simple UNIQUE (user_id, sub_materi_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sub_materi_simple_user 
  ON public.user_sub_materi_progress_simple (user_id);
  
CREATE INDEX IF NOT EXISTS idx_user_sub_materi_simple_module 
  ON public.user_sub_materi_progress_simple (module_id);

CREATE INDEX IF NOT EXISTS idx_user_sub_materi_simple_completed 
  ON public.user_sub_materi_progress_simple (user_id, is_completed);

-- ========================================
-- 3. Create new simple module progress table
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_module_progress_simple (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Frontend module ID (no foreign keys)
  module_id integer NOT NULL,           -- 1, 2, 3, 4, 5
  
  -- Progress tracking
  is_completed boolean DEFAULT false,
  progress_percentage numeric(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  completed_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint: one record per user per module
  CONSTRAINT uq_user_module_simple UNIQUE (user_id, module_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_module_simple_user 
  ON public.user_module_progress_simple (user_id);

CREATE INDEX IF NOT EXISTS idx_user_module_simple_completed 
  ON public.user_module_progress_simple (user_id, is_completed);

-- ========================================
-- Add RLS (Row Level Security) Policies
-- ========================================

-- Enable RLS
ALTER TABLE public.user_poin_progress_simple ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sub_materi_progress_simple ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_progress_simple ENABLE ROW LEVEL SECURITY;

-- Policies for user_poin_progress_simple
CREATE POLICY "Users can view own poin progress"
  ON public.user_poin_progress_simple
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own poin progress"
  ON public.user_poin_progress_simple
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own poin progress"
  ON public.user_poin_progress_simple
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for user_sub_materi_progress_simple
CREATE POLICY "Users can view own sub-materi progress"
  ON public.user_sub_materi_progress_simple
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sub-materi progress"
  ON public.user_sub_materi_progress_simple
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sub-materi progress"
  ON public.user_sub_materi_progress_simple
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for user_module_progress_simple
CREATE POLICY "Users can view own module progress"
  ON public.user_module_progress_simple
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own module progress"
  ON public.user_module_progress_simple
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own module progress"
  ON public.user_module_progress_simple
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ========================================
-- Add comments for documentation
-- ========================================
COMMENT ON TABLE public.user_poin_progress_simple IS 'Simple poin progress tracking using frontend string IDs (no foreign keys)';
COMMENT ON TABLE public.user_sub_materi_progress_simple IS 'Simple sub-materi progress tracking using frontend string IDs (no foreign keys)';
COMMENT ON TABLE public.user_module_progress_simple IS 'Simple module progress tracking using frontend integer IDs (no foreign keys)';

COMMENT ON COLUMN public.user_poin_progress_simple.poin_id IS 'Frontend poin ID string (e.g., poin1-1, poin2-3)';
COMMENT ON COLUMN public.user_poin_progress_simple.sub_materi_id IS 'Frontend sub-materi ID string (e.g., sub1, sub2)';
COMMENT ON COLUMN public.user_poin_progress_simple.module_id IS 'Frontend module ID integer (1-5)';

COMMENT ON COLUMN public.user_sub_materi_progress_simple.sub_materi_id IS 'Frontend sub-materi ID string (e.g., sub1, sub2)';
COMMENT ON COLUMN public.user_sub_materi_progress_simple.module_id IS 'Frontend module ID integer (1-5)';

COMMENT ON COLUMN public.user_module_progress_simple.module_id IS 'Frontend module ID integer (1-5)';

-- ========================================
-- Migration Complete!
-- ========================================
-- Created 3 new simple tables:
-- 1. user_poin_progress_simple - tracks poin completion
-- 2. user_sub_materi_progress_simple - tracks sub-materi completion
-- 3. user_module_progress_simple - tracks module completion
--
-- All tables:
-- ✅ Accept frontend string/integer IDs directly
-- ✅ No foreign key constraints (no UUID conflicts)
-- ✅ Have RLS policies for security
-- ✅ Have indexes for performance
-- ✅ Have unique constraints to prevent duplicates
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy paste this entire file
-- 3. Click Run (or Ctrl+Enter)
-- 4. Check output for success messages
-- 5. Backend code needs to be updated to use new table names
