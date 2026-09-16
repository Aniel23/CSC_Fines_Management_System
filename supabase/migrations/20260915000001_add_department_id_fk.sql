-- Add department_id as a nullable UUID FK on students referencing departments.id
-- The existing department TEXT column is kept for display/legacy compatibility.
-- New writes store the FK; counts use the FK exclusively.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Backfill: link existing students to their department row by name match (case-insensitive)
UPDATE public.students s
SET department_id = d.id
FROM public.departments d
WHERE LOWER(TRIM(s.department)) = LOWER(TRIM(d.name))
  AND s.department_id IS NULL;

-- Index for fast count queries
CREATE INDEX IF NOT EXISTS idx_students_department_id ON public.students(department_id);

-- Allow anon to read departments (needed for Register page dropdown)
-- Postgres does NOT support CREATE POLICY IF NOT EXISTS — use DROP + CREATE
DROP POLICY IF EXISTS "Users can view departments"     ON public.departments;
DROP POLICY IF EXISTS "Anyone can view departments"    ON public.departments;
CREATE POLICY "Anyone can view departments" ON public.departments
  FOR SELECT USING (true);
GRANT SELECT ON public.departments TO anon;

-- Update the register_new_student RPC to accept address and department_id
CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_id    TEXT,
  p_name          TEXT,
  p_age           INTEGER,
  p_gender        TEXT,
  p_department    TEXT,
  p_user_id       UUID,
  p_department_id UUID    DEFAULT NULL,
  p_address       TEXT    DEFAULT NULL
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
    -- New student: insert with text department, FK, and address
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
