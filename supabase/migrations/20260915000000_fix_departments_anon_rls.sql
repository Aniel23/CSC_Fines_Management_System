-- Allow unauthenticated (anon) users to read departments.
-- Postgres does NOT support CREATE POLICY IF NOT EXISTS — use DROP + CREATE.

DROP POLICY IF EXISTS "Users can view departments"  ON public.departments;
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Anyone can view departments" ON public.departments
  FOR SELECT USING (true);

GRANT SELECT ON public.departments TO anon;
