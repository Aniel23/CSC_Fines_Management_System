-- Add pending_payment column to fines table
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS pending_payment NUMERIC DEFAULT 0;