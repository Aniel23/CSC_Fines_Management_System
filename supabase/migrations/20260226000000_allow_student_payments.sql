-- Migration to allow students to update their own fines and record transactions
-- This enables the "Pay Fines" functionality for student users

-- 0. Update transactions table schema to match application needs (Optional but recommended)
-- ALTER TABLE public.transactions 
--   ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
--   ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50),
--   ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Completed',
--   RENAME COLUMN amount_paid TO amount;

-- 1. Allow students to update their own fines (status and balance)
DROP POLICY IF EXISTS "Students can update their own fines" ON public.fines;
CREATE POLICY "Students can update their own fines"
  ON public.fines FOR UPDATE
  TO authenticated
  USING (student_id = public.get_user_student_id(auth.uid()))
  WITH CHECK (student_id = public.get_user_student_id(auth.uid()));

-- 2. Allow students to insert their own transactions
DROP POLICY IF EXISTS "Students can insert their own transactions" ON public.transactions;
CREATE POLICY "Students can insert their own transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fines
      WHERE id = transactions.fine_id
      AND student_id = public.get_user_student_id(auth.uid())
    )
  );

-- 3. Allow students to view their own transactions
DROP POLICY IF EXISTS "Students can view their own transactions" ON public.transactions;
CREATE POLICY "Students can view their own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fines
      WHERE id = transactions.fine_id
      AND student_id = public.get_user_student_id(auth.uid())
    )
  );
