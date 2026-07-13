-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'payment', 'voucher', 'validation', 'approval'
    is_read BOOLEAN DEFAULT false,
    actor_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS to notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications"
    ON public.notifications FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin());

-- Add voucher tracking to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS voucher_used TEXT,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC;

-- Add voucher tracking to fines
ALTER TABLE public.fines
ADD COLUMN IF NOT EXISTS voucher_used TEXT,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC;

-- Note: payment_proof is already TEXT, we will store multiple URLs as a JSON string array or comma-separated string.
-- To be safe and robust, let's add a payment_proofs JSONB column to fines.
ALTER TABLE public.fines
ADD COLUMN IF NOT EXISTS payment_proofs JSONB DEFAULT '[]'::jsonb;
