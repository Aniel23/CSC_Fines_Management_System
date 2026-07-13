-- Drop existing function if it exists to allow return type changes
DROP FUNCTION IF EXISTS public.register_new_student(TEXT, TEXT, INTEGER, TEXT, TEXT, UUID);

-- Create register_new_student function
CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_id TEXT,
  p_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_department TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_student_uuid UUID;
  v_current_dept public.department;
  v_new_dept public.department;
  v_gender public.gender_type;
BEGIN
  -- 1. Check if student exists
  SELECT id, department INTO v_student_uuid, v_current_dept 
  FROM public.students 
  WHERE student_id = p_student_id;

  IF v_student_uuid IS NOT NULL THEN
    -- Student exists. Update name if provided.
    -- We ignore age/gender/dept updates for existing students to prevent overwriting with defaults
    UPDATE public.students 
    SET name = p_name 
    WHERE id = v_student_uuid;
  ELSE
    -- New student. Must provide valid details.
    
    -- Cast department
    BEGIN
      v_new_dept := p_department::public.department;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid department: %. Allowed values: BSIS, BPA, BTVTED', p_department;
    END;

    -- Cast gender
    BEGIN
      v_gender := p_gender::public.gender_type;
    EXCEPTION WHEN OTHERS THEN
       -- Fallback or error
       RAISE EXCEPTION 'Invalid gender: %', p_gender;
    END;

    INSERT INTO public.students (student_id, name, age, gender, department)
    VALUES (p_student_id, p_name, p_age, v_gender, v_new_dept)
    RETURNING id INTO v_student_uuid;
  END IF;

  -- 2. Create User Role
  -- Check if role already exists
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    INSERT INTO public.user_roles (user_id, role, student_id)
    VALUES (p_user_id, 'student', v_student_uuid);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
