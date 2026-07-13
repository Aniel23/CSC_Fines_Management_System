-- Aggressive fix for ambiguous user_id error
-- Drop all dependent RLS policies from all tables first

-- From students table
DROP POLICY IF EXISTS "Admins can view all students" ON public.students;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.students;
DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
DROP POLICY IF EXISTS "Admins can update students" ON public.students;
DROP POLICY IF EXISTS "Admins can delete students" ON public.students;

-- From fines table
DROP POLICY IF EXISTS "Admins can view all fines" ON public.fines;
DROP POLICY IF EXISTS "Admins can insert fines" ON public.fines;
DROP POLICY IF EXISTS "Admins can update fines" ON public.fines;
DROP POLICY IF EXISTS "Admins can delete fines" ON public.fines;

-- From csc_officers table
DROP POLICY IF EXISTS "Admins can manage officers" ON public.csc_officers;

-- From user_roles table
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- From transactions table
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;

-- From storage
DROP POLICY IF EXISTS "Allow admin deletes" ON storage.objects;

-- Now drop the problematic has_role function
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role) CASCADE;

-- Recreate the function with fully qualified references
CREATE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE public.user_roles.user_id = _user_id 
    AND public.user_roles.role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate students table policies
CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Students can view their own profile"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    public.students.id = (
      SELECT public.user_roles.student_id 
      FROM public.user_roles 
      WHERE public.user_roles.user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Admins can insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete students"
  ON public.students FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Recreate fines table policies
CREATE POLICY "Admins can view all fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert fines"
  ON public.fines FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update fines"
  ON public.fines FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete fines"
  ON public.fines FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Recreate csc_officers policies
CREATE POLICY "Admins can manage officers"
  ON public.csc_officers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Recreate user_roles policies
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Recreate transactions policies
CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Recreate storage policies
CREATE POLICY "Allow admin deletes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
