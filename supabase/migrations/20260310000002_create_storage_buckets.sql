-- Create storage bucket for payment proofs if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for fine images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('fine-images', 'fine-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for user assets (avatars) if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for payment-proofs
DO $$ BEGIN
    CREATE POLICY "Public Access Payment Proofs"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'payment-proofs');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated Upload Payment Proofs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'payment-proofs');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Set up RLS for fine-images
DO $$ BEGIN
    CREATE POLICY "Public Access Fine Images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'fine-images');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated Upload Fine Images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'fine-images');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Set up RLS for user-assets
DO $$ BEGIN
    CREATE POLICY "Public Access User Assets"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'user-assets');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated Upload User Assets"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'user-assets');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
