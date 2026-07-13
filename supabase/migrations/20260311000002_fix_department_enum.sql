-- Change department column to TEXT to allow any department name (e.g., BSIS-1, BTVTED-CHS-2)
-- We do this safely by casting the existing enum values to text
ALTER TABLE public.students 
ALTER COLUMN department TYPE TEXT USING department::TEXT;

-- Update the register_new_student function to handle text department
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
  v_current_dept TEXT;
  v_new_dept TEXT;
  v_gender public.gender_type;
BEGIN
  -- 1. Check if student exists
  SELECT id, department INTO v_student_uuid, v_current_dept 
  FROM public.students 
  WHERE student_id = p_student_id;

  IF v_student_uuid IS NOT NULL THEN
    -- Student exists. Update name if provided.
    UPDATE public.students 
    SET name = p_name 
    WHERE id = v_student_uuid;
  ELSE
    -- New student.
    v_new_dept := p_department; -- Direct assignment, no casting to enum

    -- Cast gender
    BEGIN
      v_gender := p_gender::public.gender_type;
    EXCEPTION WHEN OTHERS THEN
       -- Fallback to 'Other' if invalid gender provided
       v_gender := 'Other';
    END;

    INSERT INTO public.students (student_id, name, age, gender, department)
    VALUES (p_student_id, p_name, p_age, v_gender, v_new_dept)
    RETURNING id INTO v_student_uuid;
  END IF;

  -- 2. Create User Role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    INSERT INTO public.user_roles (user_id, role, student_id)
    VALUES (p_user_id, 'student', v_student_uuid);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
