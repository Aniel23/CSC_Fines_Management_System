-- Fix the has_role function to fully qualify table references (removes ambiguity)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE public.user_roles.user_id = _user_id AND public.user_roles.role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin policies for managing students (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
CREATE POLICY "Admins can insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update students" ON public.students;
CREATE POLICY "Admins can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete students" ON public.students;
CREATE POLICY "Admins can delete students"
  ON public.students FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix the Students SELECT policy to fully qualify table reference
DROP POLICY IF EXISTS "Students can view their own profile" ON public.students;
CREATE POLICY "Students can view their own profile"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    public.students.id = (
      SELECT public.user_roles.student_id FROM public.user_roles 
      WHERE public.user_roles.user_id = auth.uid() LIMIT 1
    )
  );
