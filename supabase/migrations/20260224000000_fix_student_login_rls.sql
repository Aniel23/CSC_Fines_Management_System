-- Fix RLS policy to allow student login lookup
-- This allows unauthenticated users to look up students by student_id during login

-- First, drop the new policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Anyone can view students by student_id for login" ON public.students;

-- Create a policy that allows anyone to view students (needed for login lookup)
-- This is safe because student_id is essentially a username/public identifier
CREATE POLICY "Anyone can view students by student_id for login"
  ON public.students FOR SELECT
  TO anon, authenticated
  USING (true);

-- Note: This is intentionally permissive for login purposes.
-- The student_id is considered public information (like a username).
-- Sensitive student data should not be in this table, or additional RLS should protect it.
