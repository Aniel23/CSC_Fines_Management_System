-- STEP 1: Run this separately first!
-- Postgres requires new enum values to be committed before they can be used in the same session.
ALTER TYPE public.fine_status ADD VALUE IF NOT EXISTS 'To Pay' BEFORE 'Pending';

-- STEP 2: Run this AFTER Step 1 is finished!
-- Update existing "Pending" fines that don't have transactions to "To Pay"
UPDATE public.fines
SET status = 'To Pay'
WHERE status = 'Pending'
AND NOT EXISTS (
  SELECT 1 FROM public.transactions
  WHERE transactions.fine_id = fines.id
);

-- Set the default value for future fines to "To Pay"
ALTER TABLE public.fines ALTER COLUMN status SET DEFAULT 'To Pay';
