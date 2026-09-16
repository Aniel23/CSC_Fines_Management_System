-- Fix departments RLS so unauthenticated users (e.g. Register page) can read department names.
-- The original policy restricted SELECT to auth.role() = 'authenticated', which blocked
-- anonymous visitors and caused the Register dropdown to fall back to the static list.

-- 1. Drop the old authenticated-only read policy
DROP POLICY IF EXISTS "Users can view departments" ON public.departments;

-- 2. Create a new policy that allows both anon and authenticated users to SELECT
CREATE POLICY "Anyone can view departments" ON public.departments
  FOR SELECT USING (true);

-- 3. Grant SELECT to the anon role so the Supabase JS client can read without auth
GRANT SELECT ON public.departments TO anon;
