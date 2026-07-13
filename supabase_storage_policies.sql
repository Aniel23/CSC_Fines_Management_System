-- SQL commands to create the storage bucket and policies
-- Run these in the Supabase SQL Editor

-- 1. Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users (students) to upload files to 'payment-proofs'
-- Drop existing policy if any to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'payment-proofs' );

-- 3. Allow public access to view files in 'payment-proofs'
DROP POLICY IF EXISTS "Allow public view" ON storage.objects;

CREATE POLICY "Allow public view"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'payment-proofs' );
