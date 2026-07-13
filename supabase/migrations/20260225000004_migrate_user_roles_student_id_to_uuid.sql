-- Migrate public.user_roles.student_id to UUID and enforce FK to public.students(id)
-- Handles cases where the existing column stores either UUID text or a student code matching students.student_id

DO $$
BEGIN
  -- If the column is already UUID, do nothing
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_roles'
      AND column_name  = 'student_id'
      AND udt_name     = 'uuid'
  ) THEN
    RAISE NOTICE 'user_roles.student_id is already UUID';
  ELSE
    -- Add a temporary UUID column for migration
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'user_roles'
        AND column_name  = 'student_id_uuid'
    ) THEN
      ALTER TABLE public.user_roles ADD COLUMN student_id_uuid UUID;
    END IF;

    -- 1) Direct cast for values that are UUID-like
    UPDATE public.user_roles ur
    SET student_id_uuid = ur.student_id::uuid
    WHERE ur.student_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    -- 2) Join by student code: map user_roles.student_id (text code) -> students.id (uuid)
    UPDATE public.user_roles ur
    SET student_id_uuid = s.id
    FROM public.students s
    WHERE ur.student_id_uuid IS NULL
      AND ur.student_id IS NOT NULL
      AND s.student_id = ur.student_id;

    -- Drop existing FK on the old student_id if present
    ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_student_id_fkey;

    -- Replace old column with the migrated UUID column
    ALTER TABLE public.user_roles DROP COLUMN student_id;
    ALTER TABLE public.user_roles RENAME COLUMN student_id_uuid TO student_id;

    -- Reinstate FK to students(id), ON DELETE SET NULL for safety
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_student_id_fkey
      FOREIGN KEY (student_id)
      REFERENCES public.students(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

