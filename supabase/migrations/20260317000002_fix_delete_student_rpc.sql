-- Improve delete_student_with_auth function to be more robust
-- It ensures that even if user_roles are somehow missing or broken, we try our best to clean up.
-- Also, it handles cases where the auth user might not exist anymore.

CREATE OR REPLACE FUNCTION public.delete_student_with_auth(p_student_id UUID)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Find the user_id associated with this student from user_roles
  -- We do this BEFORE deleting anything else to ensure we capture the link
  SELECT user_id INTO v_user_id
  FROM public.user_roles
  WHERE student_id = p_student_id
  LIMIT 1;

  -- 2. Delete related records first (if cascades don't handle them, but they should)
  -- Just to be safe and explicit about order
  
  -- Delete user_roles explicitly
  DELETE FROM public.user_roles
  WHERE student_id = p_student_id;

  -- 3. Delete the auth user if found (using service role context)
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users
      WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue? Or re-raise? 
      -- If we can't delete the auth user, we probably shouldn't delete the student if strict consistency is needed.
      -- But usually we want to force delete.
      RAISE WARNING 'Could not delete auth user %: %', v_user_id, SQLERRM;
    END;
  END IF;

  -- 4. Delete the student record
  -- This will cascade to fines (and transactions if cascade set, or set null if updated)
  DELETE FROM public.students
  WHERE id = p_student_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated users (admins) to execute this function
GRANT EXECUTE ON FUNCTION public.delete_student_with_auth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_with_auth(UUID) TO service_role;
