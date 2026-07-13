-- Ensure department column is TEXT (not ENUM) to allow flexible values
ALTER TABLE public.students 
ALTER COLUMN department TYPE TEXT USING department::TEXT;

-- Ensure Admins can view ALL students (SELECT policy)
DROP POLICY IF EXISTS "Admins can view all students" ON public.students;
CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure Admins can view ALL fines (SELECT policy)
DROP POLICY IF EXISTS "Admins can view all fines" ON public.fines;
CREATE POLICY "Admins can view all fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure Admins can view ALL transactions (SELECT policy)
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure Admins can view ALL user_roles (SELECT policy)
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
