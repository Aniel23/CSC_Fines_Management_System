-- Ensure get_user_student_id returns a UUID (not text)
-- Some environments may have an incorrect function body that selects a text identifier.
-- This replaces it with a version that always returns the UUID of the linked student.
CREATE OR REPLACE FUNCTION public.get_user_student_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.student_id::uuid
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  ORDER BY ur.id DESC
  LIMIT 1
$$;

