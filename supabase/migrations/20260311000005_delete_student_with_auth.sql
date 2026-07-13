-- Create a function to safely delete a student and their associated auth account
CREATE OR REPLACE FUNCTION public.delete_student_with_auth(p_student_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Find the user_id associated with this student
  SELECT user_id INTO v_user_id
  FROM public.user_roles
  WHERE student_id = p_student_id
  LIMIT 1;

  -- 2. Delete the user_roles record(s) for this student
  DELETE FROM public.user_roles
  WHERE student_id = p_student_id;

  -- 3. Delete the auth user if found (using service role context)
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users
    WHERE id = v_user_id;
  END IF;

  -- 4. Delete the student record
  DELETE FROM public.students
  WHERE id = p_student_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated users (admins) to execute this function
GRANT EXECUTE ON FUNCTION public.delete_student_with_auth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_with_auth(UUID) TO service_role;
