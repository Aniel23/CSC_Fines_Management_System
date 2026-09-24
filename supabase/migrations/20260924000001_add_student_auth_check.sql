-- Check whether an enrolled student is already linked to an auth user.
-- This must run as SECURITY DEFINER because registration visitors are anonymous
-- and cannot safely query user_roles or auth.users directly.
CREATE OR REPLACE FUNCTION public.has_student_auth_account(p_student_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students AS s
    JOIN public.user_roles AS ur ON ur.student_id = s.id
    JOIN auth.users AS au ON au.id = ur.user_id
    WHERE ur.role = 'student'
      AND lower(regexp_replace(trim(s.student_id), '\s+', '', 'g')) =
          lower(regexp_replace(trim(p_student_id), '\s+', '', 'g'))
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_student_auth_account(TEXT)
  TO anon, authenticated;
