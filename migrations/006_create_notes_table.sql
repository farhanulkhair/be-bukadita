-- Migration: Create Notes Table for User Personal Notes
-- Date: 2025-10-11
-- Description: Create notes table with RLS policies for user personal notes feature

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NULL,
  content text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes USING btree (user_id) TABLESPACE pg_default;

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_notes_fulltext ON public.notes USING gin (
  to_tsvector(
    'simple'::regconfig,
    (
      (COALESCE(title, ''::text) || ' '::text) || COALESCE(content, ''::text)
    )
  )
) TABLESPACE pg_default;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON public.notes USING btree (user_id, pinned) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_notes_user_archived ON public.notes USING btree (user_id, archived) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON public.notes USING btree (user_id, updated_at DESC) TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Users can select their own notes
CREATE POLICY "notes_select_own" ON public.notes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own notes
CREATE POLICY "notes_insert_own" ON public.notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own notes
CREATE POLICY "notes_update_own" ON public.notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notes
CREATE POLICY "notes_delete_own" ON public.notes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.notes IS 'Personal notes for users with full-text search capabilities';
COMMENT ON COLUMN public.notes.user_id IS 'Reference to the owner of the note';
COMMENT ON COLUMN public.notes.title IS 'Optional title for the note';
COMMENT ON COLUMN public.notes.content IS 'Main content of the note';
COMMENT ON COLUMN public.notes.pinned IS 'Whether note is pinned to top';
COMMENT ON COLUMN public.notes.archived IS 'Whether note is archived';
COMMENT ON INDEX public.idx_notes_fulltext IS 'Full-text search index for title and content';