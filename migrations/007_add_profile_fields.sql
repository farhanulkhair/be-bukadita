-- Migration: Add new profile fields (address, profil_url, date_of_birth)
-- Date: 2025-10-12
-- Description: Add address, profile photo URL, and date of birth fields to profiles table

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address text NULL,
ADD COLUMN IF NOT EXISTS profil_url text NULL,
ADD COLUMN IF NOT EXISTS date_of_birth date NULL;

-- Create index for date_of_birth for potential age-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth ON public.profiles USING btree (date_of_birth) TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.address IS 'User address';
COMMENT ON COLUMN public.profiles.profil_url IS 'Profile photo URL from foto_profil bucket';
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth for age calculation';

-- Note: foto_profil bucket should be created manually in Supabase dashboard with public access
-- Bucket configuration:
-- - Name: foto_profil
-- - Public: true (for profile photos)
-- - File size limit: 5MB
-- - Allowed mime types: image/jpeg, image/png, image/webp