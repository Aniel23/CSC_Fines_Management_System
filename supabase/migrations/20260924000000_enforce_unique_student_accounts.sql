-- A student record must belong to at most one student account.
-- Without this constraint, two auth users can read the same student dashboard.

-- Repair existing duplicate links before enforcing the constraint. Prefer the
-- account whose email matches the student record; otherwise keep a stable row.
WITH ranked_roles AS (
  SELECT
    ur.id,
    row_number() OVER (
      PARTITION BY ur.student_id
      ORDER BY
        CASE
          WHEN lower(au.email) = lower(s.email) THEN 0
          ELSE 1
        END,
        ur.id
    ) AS role_rank
  FROM public.user_roles AS ur
  JOIN public.students AS s ON s.id = ur.student_id
  LEFT JOIN auth.users AS au ON au.id = ur.user_id
  WHERE ur.role = 'student'
    AND ur.student_id IS NOT NULL
)
DELETE FROM public.user_roles AS ur
USING ranked_roles AS duplicate_roles
WHERE ur.id = duplicate_roles.id
  AND duplicate_roles.role_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_student_account_idx
  ON public.user_roles (student_id)
  WHERE role = 'student' AND student_id IS NOT NULL;

-- Student IDs are identifiers, not case-sensitive display text.
CREATE UNIQUE INDEX IF NOT EXISTS students_normalized_student_id_idx
  ON public.students (lower(regexp_replace(trim(student_id), '\s+', '', 'g')));

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
  v_student_key TEXT;
BEGIN
  v_student_key := lower(regexp_replace(trim(p_student_id), '\s+', '', 'g'));

  SELECT id INTO v_student_uuid
  FROM public.students
  WHERE lower(regexp_replace(trim(student_id), '\s+', '', 'g')) = v_student_key
  FOR UPDATE;

  IF v_student_uuid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE student_id = v_student_uuid
      AND role = 'student'
      AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Student ID is already registered';
  END IF;

  IF v_student_uuid IS NOT NULL THEN
    UPDATE public.students
    SET name = regexp_replace(trim(p_name), '\s+', ' ', 'g'),
        email = COALESCE(NULLIF(lower(trim(p_email)), ''), email)
    WHERE id = v_student_uuid;
  ELSE
    v_gender := p_gender::public.gender_type;
    INSERT INTO public.students (
      student_id, name, age, gender, department, department_id, address, email
    )
    VALUES (
      trim(p_student_id),
      regexp_replace(trim(p_name), '\s+', ' ', 'g'),
      p_age,
      v_gender,
      trim(p_department),
      p_department_id,
      NULLIF(regexp_replace(trim(p_address), '\s+', ' ', 'g'), ''),
      NULLIF(lower(trim(p_email)), '')
    )
    RETURNING id INTO v_student_uuid;
  END IF;

  INSERT INTO public.user_roles (user_id, role, student_id)
  VALUES (p_user_id, 'student', v_student_uuid)
  ON CONFLICT (user_id, role) DO UPDATE
    SET student_id = EXCLUDED.student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_new_student(TEXT, TEXT, INTEGER, TEXT, TEXT, UUID, UUID, TEXT, TEXT)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_student_auth_email(p_student_id TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT s.email
  FROM public.students AS s
  WHERE lower(regexp_replace(trim(s.student_id), '\s+', '', 'g')) =
        lower(regexp_replace(trim(p_student_id), '\s+', '', 'g'))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_auth_email(TEXT) TO anon, authenticated;