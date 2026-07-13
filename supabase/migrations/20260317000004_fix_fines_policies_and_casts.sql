-- Fix missing student policy for fines and add explicit casts for admin checks
-- This addresses potential 400 errors due to RLS function ambiguity or missing policies

-- Fines Table: Re-add student access to their own fines
DROP POLICY IF EXISTS "Students can view their own fines" ON public.fines;
CREATE POLICY "Students can view their own fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (
    student_id = (
      SELECT student_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Update Admin policies with explicit casts to avoid ambiguity
DROP POLICY IF EXISTS "Admins can view all fines" ON public.fines;
CREATE POLICY "Admins can view all fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert fines" ON public.fines;
CREATE POLICY "Admins can insert fines"
  ON public.fines FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update fines" ON public.fines;
CREATE POLICY "Admins can update fines"
  ON public.fines FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Transactions Table: Re-add student access to their own transactions
DROP POLICY IF EXISTS "Students can view their own transactions" ON public.transactions;
CREATE POLICY "Students can view their own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fines
      WHERE id = transactions.fine_id
      AND student_id = (
        SELECT student_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Update other admin policies with casts
DROP POLICY IF EXISTS "Admins can view all students" ON public.students;
CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
CREATE POLICY "Admins can insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update students" ON public.students;
CREATE POLICY "Admins can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
