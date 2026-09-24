-- Let a student edit only their own safe profile fields.
CREATE OR REPLACE FUNCTION public.update_own_student_profile(
  p_name TEXT,
  p_age INTEGER,
  p_gender TEXT,
  p_address TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_name TEXT;
  v_address TEXT;
  v_gender public.gender_type;
BEGIN
  v_student_id := public.get_user_student_id(auth.uid())::uuid;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;

  v_name := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_address := NULLIF(regexp_replace(trim(COALESCE(p_address, '')), '\s+', ' ', 'g'), '');

  IF v_name = '' OR length(v_name) > 255 THEN
    RAISE EXCEPTION 'Name must be between 1 and 255 characters';
  END IF;

  IF p_age IS NULL OR p_age < 15 OR p_age > 100 THEN
    RAISE EXCEPTION 'Age must be between 15 and 100';
  END IF;

  IF v_address IS NOT NULL AND length(v_address) > 500 THEN
    RAISE EXCEPTION 'Address must not exceed 500 characters';
  END IF;

  BEGIN
    v_gender := p_gender::public.gender_type;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid gender';
  END;

  UPDATE public.students
  SET name = v_name,
      age = p_age,
      gender = v_gender,
      address = v_address
  WHERE id = v_student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_student_profile(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_student_profile(TEXT, INTEGER, TEXT, TEXT) TO authenticated;
