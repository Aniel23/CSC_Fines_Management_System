-- Keep Auth user metadata useful for recognition in the Supabase dashboard.
UPDATE auth.users AS u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'name', s.name,
    'student_id', s.student_id,
    'role', 'student'
  )
FROM public.user_roles AS ur
JOIN public.students AS s ON s.id = ur.student_id
WHERE ur.user_id = u.id
  AND ur.role = 'student'
  AND s.name IS NOT NULL;