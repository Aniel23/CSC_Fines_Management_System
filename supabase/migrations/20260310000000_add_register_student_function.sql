-- Function to handle student registration safely bypassing RLS
CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_id TEXT,
  p_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_department TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_uuid UUID;
BEGIN
  -- 1. Check if student exists, if so get ID, if not insert
  SELECT id INTO v_student_uuid FROM public.students WHERE student_id = p_student_id;
  
  IF v_student_uuid IS NULL THEN
    INSERT INTO public.students (student_id, name, age, gender, department)
    VALUES (p_student_id, p_name, p_age, p_gender::public.gender_type, p_department::public.department)
    RETURNING id INTO v_student_uuid;
  END IF;

  -- 2. Insert into user_roles if not exists
  INSERT INTO public.user_roles (user_id, role, student_id)
  VALUES (p_user_id, 'student', v_student_uuid)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_student_uuid;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_new_student TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_new_student TO service_role;
GRANT EXECUTE ON FUNCTION public.register_new_student TO anon; -- Allow anon if signup doesn't auto-login immediately (though usually it needs auth)
