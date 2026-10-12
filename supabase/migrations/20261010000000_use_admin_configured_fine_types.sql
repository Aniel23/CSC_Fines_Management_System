-- Fine violations are configurable in Admin Profile, so fine_type must not be
-- restricted to the original hard-coded enum values.
ALTER TABLE public.fines
  ALTER COLUMN fine_type TYPE TEXT
  USING fine_type::TEXT;

DROP TYPE IF EXISTS public.fine_type;
