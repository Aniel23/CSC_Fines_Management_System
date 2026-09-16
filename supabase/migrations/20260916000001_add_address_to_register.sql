-- Update the register_new_student RPC to also accept and store address
CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_id   TEXT,
  p_name         TEXT,
  p_age          INTEGER,
  p_gender       TEXT,
  p_department   TEXT,
  p_user_id      UUID,
  p_department_id UUID DEFAULT NULL,
  p_address      TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_student_uuid UUID;
  v_gender       public.gender_type;
BEGIN
  -- 1. Check if student record already exists
  SELECT id INTO v_student_uuid
  FROM public.students
  WHERE student_id = p_student_id;

  IF v_student_uuid IS NOT NULL THEN
    -- Existing student: only update name (keep all other data intact)
    UPDATE public.students
    SET name = p_name
    WHERE id = v_student_uuid;
  ELSE
    -- New student: insert with both text department and FK
    BEGIN
      v_gender := p_gender::public.gender_type;
    EXCEPTION WHEN OTHERS THEN
      v_gender := 'Other';
    END;

    INSERT INTO public.students (student_id, name, age, gender, department, department_id, address)
    VALUES (p_student_id, p_name, p_age, v_gender, p_department, p_department_id, p_address)
    RETURNING id INTO v_student_uuid;
  END IF;

  -- 2. Create user_role link if not already present
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    INSERT INTO public.user_roles (user_id, role, student_id)
    VALUES (p_user_id, 'student', v_student_uuid);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;