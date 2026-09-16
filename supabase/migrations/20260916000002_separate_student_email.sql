-- Store a real email separately from the student's public login ID.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS students_email_unique_idx
  ON public.students (lower(email))
  WHERE email IS NOT NULL;

-- Preserve real emails for any accounts that already exist.
UPDATE public.students AS s
SET email = u.email
FROM public.user_roles AS ur
JOIN auth.users AS u ON u.id = ur.user_id
WHERE ur.student_id = s.id
  AND u.email IS NOT NULL
  AND u.email NOT LIKE '%@student.local'
  AND s.email IS NULL;

-- Registration stores the real email on both auth.users and students.
CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_id TEXT,
  p_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_department TEXT,
  p_user_id UUID,
  p_department_id UUID DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_uuid UUID;
  v_gender public.gender_type;
BEGIN
  SELECT id INTO v_student_uuid
  FROM public.students
  WHERE student_id = p_student_id;

  IF v_student_uuid IS NOT NULL THEN
    UPDATE public.students
    SET name = p_name,
        email = COALESCE(NULLIF(lower(trim(p_email)), ''), email)
    WHERE id = v_student_uuid;
  ELSE
    BEGIN
      v_gender := p_gender::public.gender_type;
    EXCEPTION WHEN OTHERS THEN
      v_gender := 'Other';
    END;

    INSERT INTO public.students (
      student_id, name, age, gender, department, department_id, address, email
    )
    VALUES (
      p_student_id, p_name, p_age, v_gender, p_department,
      p_department_id, p_address, NULLIF(lower(trim(p_email)), '')
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

-- Resolve a student ID to its real auth email without exposing auth.users.
CREATE OR REPLACE FUNCTION public.get_student_auth_email(p_student_id TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT s.email
  FROM public.students AS s
  WHERE s.student_id = trim(p_student_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_auth_email(TEXT) TO anon, authenticated;