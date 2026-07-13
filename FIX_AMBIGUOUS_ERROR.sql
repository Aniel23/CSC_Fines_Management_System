-- ==============================================================================
-- RUN THIS SCRIPT IN YOUR SUPABASE DASHBOARD SQL EDITOR TO FIX THE ERROR
-- ==============================================================================

-- 1. Fix the `has_role` function which is causing the "ambiguous user_id" error
-- We use explicit table aliases (ur) and parameter names to prevent confusion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles AS ur
    WHERE ur.user_id = _user_id 
      AND ur.role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a safer `is_admin` function that takes no parameters (impossible to be ambiguous)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'::public.app_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Fines Policies to use the safer `is_admin` function
DROP POLICY IF EXISTS "Admins can insert fines" ON public.fines;
CREATE POLICY "Admins can insert fines"
  ON public.fines FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all fines" ON public.fines;
CREATE POLICY "Admins can view all fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update fines" ON public.fines;
CREATE POLICY "Admins can update fines"
  ON public.fines FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete fines" ON public.fines;
CREATE POLICY "Admins can delete fines"
  ON public.fines FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. Update Students Policies (to prevent similar errors there)
DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
CREATE POLICY "Admins can insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all students" ON public.students;
CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update students" ON public.students;
CREATE POLICY "Admins can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete students" ON public.students;
CREATE POLICY "Admins can delete students"
  ON public.students FOR DELETE
  TO authenticated
  USING (public.is_admin());
