-- Change transactions -> fines FK to SET NULL to preserve history
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_fine_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_fine_id_fkey
  FOREIGN KEY (fine_id)
  REFERENCES public.fines(id)
  ON DELETE SET NULL;

-- Allow fine_id to be NULL
ALTER TABLE public.transactions ALTER COLUMN fine_id DROP NOT NULL;

-- Add fallback columns to store historical data when the relation is lost
-- We'll populate these via a trigger or manually in the application code in the future if needed
-- For now, just allowing NULL fine_id is the first step requested.
-- However, without the student/fine data, the transaction record becomes orphan and hard to identify.
-- As per user instruction "Remove Foreign Key Constraints Only", we stop here.
