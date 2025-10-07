-- Migration 003: Add missing fields to poin_media_materis table
-- Jalankan di Supabase SQL Editor SETELAH migration 002

-- Add missing fields yang dibutuhkan frontend
ALTER TABLE public.poin_media_materis 
ADD COLUMN IF NOT EXISTS original_filename text,
ADD COLUMN IF NOT EXISTS mime_type text,
ADD COLUMN IF NOT EXISTS file_size bigint;

-- Update existing records untuk set default values
UPDATE public.poin_media_materis 
SET 
  original_filename = 'unknown.jpg',
  mime_type = CASE 
    WHEN type = 'image' THEN 'image/jpeg'
    WHEN type = 'video' THEN 'video/mp4'  
    WHEN type = 'audio' THEN 'audio/mpeg'
    WHEN type = 'pdf' THEN 'application/pdf'
    ELSE 'application/octet-stream'
  END,
  file_size = 0
WHERE original_filename IS NULL OR mime_type IS NULL OR file_size IS NULL;

-- Add NOT NULL constraints after updating existing data
ALTER TABLE public.poin_media_materis 
ALTER COLUMN original_filename SET NOT NULL,
ALTER COLUMN mime_type SET NOT NULL,
ALTER COLUMN file_size SET NOT NULL;