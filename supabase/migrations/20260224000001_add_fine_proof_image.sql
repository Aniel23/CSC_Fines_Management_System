-- Add proof_image column to fines table for violation evidence
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS proof_image TEXT;

-- Create storage bucket for fine images
INSERT INTO storage.buckets (id, name, public)
VALUES ('fine-images', 'fine-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
DO $$ BEGIN
    CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'fine-images');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Allow anyone to view images (public bucket)
DO $$ BEGIN
    CREATE POLICY "Allow public read access"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'fine-images');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Allow admins to delete images
DO $$ BEGIN
    CREATE POLICY "Allow admin deletes"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'fine-images' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
