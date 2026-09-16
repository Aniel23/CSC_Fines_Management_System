-- =============================================================================
-- FIX LOGIN BUG: Circular RLS recursion on user_roles
-- =============================================================================
-- Root cause: has_role() queries user_roles to check if caller is admin.
-- RLS policies on user_roles also call has_role() to decide who can SELECT.
-- This creates an infinite loop → Supabase returns 0 rows → loadUserData
-- gets no role back → user appears stuck / not properly logged in.
--
-- Fix:
--   1. Replace has_role() with a SECURITY DEFINER function that bypasses RLS.
--   2. Replace is_admin()  with a SECURITY DEFINER function that bypasses RLS.
--   3. Simplify user_roles SELECT: users see their own row OR they are admin.
--      No call to has_role inside the SELECT policy itself.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rebuild has_role() with SET search_path and explicit RLS bypass
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role    = _role
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Rebuild is_admin() the same way
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role    = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Fix user_roles SELECT policies — remove all, replace with one clean policy
--    that uses NO function call (avoids any chance of recursion).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own role"      ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user_roles"     ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles"            ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select"                  ON public.user_roles;

-- Allow any authenticated user to read rows that belong to them.
-- Admins need to read ALL rows (for the admin dashboard).
-- We use a direct subquery instead of has_role() to avoid recursion.
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()                          -- own row always visible
    OR EXISTS (                                   -- admin can see all rows
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid()
        AND ur2.role = 'admin'
    )
  );

-- Re-create write policies using the fixed has_role (safe now — SECURITY DEFINER bypasses RLS)
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;

CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING     (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Also allow the register_new_student RPC (SECURITY DEFINER) to insert user_roles
-- for new students. The RPC runs as the function owner so it bypasses RLS anyway.
-- Nothing extra needed here.

-- -----------------------------------------------------------------------------
-- 4. Ensure students SELECT lets a student always see their own row.
--    The existing "Anyone can view students by student_id for login" (USING true)
--    already covers this — just make sure it isn't accidentally missing.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view students by student_id for login" ON public.students;
CREATE POLICY "Anyone can view students by student_id for login"
  ON public.students FOR SELECT
  TO anon, authenticated
  USING (true);
