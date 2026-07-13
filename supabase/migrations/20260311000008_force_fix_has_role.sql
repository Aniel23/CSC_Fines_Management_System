-- Completely fix ambiguous column references
-- 1. We'll drop policies that might be causing issues (though not strictly necessary if we fix the function)
-- 2. We'll rewrite the function to be 100% unambiguous using table aliases AND different parameter names if possible,
--    but since we can't change param names easily, we will stick to the alias strategy which is robust.

-- RE-APPLYING the fix with explicit table qualification.
-- The previous attempt might have failed silently or wasn't applied.

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  -- Explicitly qualify table columns with "ur" alias
  -- Explicitly use parameters
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles AS ur
    WHERE ur.user_id = _user_id 
      AND ur.role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Just in case there are other ambiguous policies, let's fix the user_roles policy specifically
-- "Users can view their own role" often causes recursion or ambiguity if not careful
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
