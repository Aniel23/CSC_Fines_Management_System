-- Harden RLS policies by ensuring uuid casts on comparisons that use get_user_student_id

-- Fines: Students can view their own fines
DROP POLICY IF EXISTS "Students can view their own fines" ON public.fines;
CREATE POLICY "Students can view their own fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (student_id = public.get_user_student_id(auth.uid())::uuid);

-- Students: Students can view their own record
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
CREATE POLICY "Students can view their own record"
  ON public.students FOR SELECT
  TO authenticated
  USING (id = public.get_user_student_id(auth.uid())::uuid);

