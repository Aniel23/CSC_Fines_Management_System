-- Fix ambiguous column reference in has_role function
-- We must use CREATE OR REPLACE with the ORIGINAL parameter names (_user_id, _role)
-- to avoid dependency errors. We resolve ambiguity by using table aliases.

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
