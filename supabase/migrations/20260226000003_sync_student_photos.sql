-- Sync existing avatar_url from user_roles to students.photo_url
UPDATE public.students
SET photo_url = ur.avatar_url
FROM public.user_roles ur
WHERE public.students.id = ur.student_id
AND ur.avatar_url IS NOT NULL;
