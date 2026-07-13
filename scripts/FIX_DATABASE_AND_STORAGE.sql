-- FIX 1: Create table for contact messages (from previous step)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anon) to insert messages
DROP POLICY IF EXISTS "Anyone can insert contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can insert contact messages"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow admins to view messages
DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;
CREATE POLICY "Admins can view contact messages"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update (mark as read)
DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages"
  ON public.contact_messages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- FIX 2: Create storage buckets for payment proofs (from previous step)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fine-images', 'fine-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for payment-proofs
DROP POLICY IF EXISTS "Public Access Payment Proofs" ON storage.objects;
CREATE POLICY "Public Access Payment Proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Authenticated Upload Payment Proofs" ON storage.objects;
CREATE POLICY "Authenticated Upload Payment Proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- RLS for fine-images
DROP POLICY IF EXISTS "Public Access Fine Images" ON storage.objects;
CREATE POLICY "Public Access Fine Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fine-images');

DROP POLICY IF EXISTS "Authenticated Upload Fine Images" ON storage.objects;
CREATE POLICY "Authenticated Upload Fine Images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fine-images');

-- RLS for user-assets
DROP POLICY IF EXISTS "Public Access User Assets" ON storage.objects;
CREATE POLICY "Public Access User Assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-assets');

DROP POLICY IF EXISTS "Authenticated Upload User Assets" ON storage.objects;
CREATE POLICY "Authenticated Upload User Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-assets');

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated, service_role;
