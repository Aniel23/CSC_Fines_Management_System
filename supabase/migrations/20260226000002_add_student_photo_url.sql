-- Add photo_url to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;
