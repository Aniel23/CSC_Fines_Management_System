-- Add is_archived and deleted_at to fines
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add is_archived and deleted_at to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add is_archived and deleted_at to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add is_archived and deleted_at to contact_messages
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Allow students to permanently delete their own fines
DROP POLICY IF EXISTS "Students can delete their own fines" ON public.fines;
CREATE POLICY "Students can delete their own fines"
  ON public.fines FOR DELETE
  TO authenticated
  USING (student_id = public.get_user_student_id(auth.uid()));

-- Allow students to permanently delete their own transactions
DROP POLICY IF EXISTS "Students can delete their own transactions" ON public.transactions;
CREATE POLICY "Students can delete their own transactions"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fines
      WHERE id = transactions.fine_id
      AND student_id = public.get_user_student_id(auth.uid())
    )
  );

-- Allow students to update their own transactions (for bin/archive)
DROP POLICY IF EXISTS "Students can update their own transactions" ON public.transactions;
CREATE POLICY "Students can update their own transactions"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fines
      WHERE id = transactions.fine_id
      AND student_id = public.get_user_student_id(auth.uid())
    )
  );
