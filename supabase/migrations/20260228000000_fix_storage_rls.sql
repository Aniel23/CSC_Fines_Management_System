-- Enable RLS on storage.objects if not already enabled
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Create a public bucket for payment proofs if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow authenticated users (students) to upload files to 'payment-proofs'
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'payment-proofs' );

-- 3. Allow authenticated users to view/download files in 'payment-proofs'
DROP POLICY IF EXISTS "Allow public view" ON storage.objects;
CREATE POLICY "Allow public view"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'payment-proofs' );

-- 4. Allow users to update their own files (optional, good for retries)
DROP POLICY IF EXISTS "Allow individual update" ON storage.objects;
CREATE POLICY "Allow individual update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( auth.uid() = owner )
WITH CHECK ( bucket_id = 'payment-proofs' );

-- 5. Allow users to delete their own files
DROP POLICY IF EXISTS "Allow individual delete" ON storage.objects;
CREATE POLICY "Allow individual delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( auth.uid() = owner AND bucket_id = 'payment-proofs' );
