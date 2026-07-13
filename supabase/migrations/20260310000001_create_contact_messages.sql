-- Create table for contact messages
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
DO $$ BEGIN
    CREATE POLICY "Anyone can insert contact messages"
      ON public.contact_messages FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Allow admins to view messages
DO $$ BEGIN
    CREATE POLICY "Admins can view contact messages"
      ON public.contact_messages FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Allow admins to update (mark as read)
DO $$ BEGIN
    CREATE POLICY "Admins can update contact messages"
      ON public.contact_messages FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
