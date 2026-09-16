-- Keep registration aligned with the students.department TEXT column.
CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_id   TEXT,
  p_name         TEXT,
  p_age          INTEGER,
  p_gender       TEXT,
  p_department   TEXT,
  p_user_id      UUID,
  p_department_id UUID DEFAULT NULL,
  p_address      TEXT DEFAULT NULL,
  p_email        TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_uuid UUID;
  v_gender       public.gender_type;
  v_name         TEXT;
  v_address      TEXT;
  v_email        TEXT;
BEGIN
  v_name := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_address := NULLIF(regexp_replace(trim(p_address), '\s+', ' ', 'g'), '');
  v_email := NULLIF(lower(regexp_replace(trim(p_email), '\s+', '', 'g')), '');

  IF v_name = '' OR length(v_name) > 255 OR v_name !~ '^[[:alpha:]][[:alpha:].'' -]*$' THEN
    RAISE EXCEPTION 'Invalid name format';
  END IF;

  IF v_address IS NOT NULL AND length(v_address) > 500 THEN
    RAISE EXCEPTION 'Address must not exceed 500 characters';
  END IF;

  IF v_email IS NULL OR length(v_email) > 255 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid email address format';
  END IF;

  SELECT id INTO v_student_uuid
  FROM public.students
  WHERE student_id = trim(p_student_id);

  IF v_student_uuid IS NOT NULL THEN
    UPDATE public.students
    SET name = v_name,
      email = v_email
    WHERE id = v_student_uuid;
  ELSE
    BEGIN
      v_gender := p_gender::public.gender_type;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid student registration details: %', SQLERRM;
    END;

    INSERT INTO public.students (
      student_id, name, age, gender, department, department_id, address, email
    )
    VALUES (
      trim(p_student_id), v_name, p_age, v_gender, trim(p_department),
      p_department_id, v_address, v_email
    )
    RETURNING id INTO v_student_uuid;
  END IF;

  INSERT INTO public.user_roles (user_id, role, student_id)
  VALUES (p_user_id, 'student', v_student_uuid)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_new_student(TEXT, TEXT, INTEGER, TEXT, TEXT, UUID, UUID, TEXT, TEXT)
  TO anon, authenticated, service_role;