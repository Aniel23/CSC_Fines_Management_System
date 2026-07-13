-- Use this script to grant yourself admin permissions in Supabase
-- Run this in the Supabase SQL Editor

DO $$
DECLARE
  v_user_id UUID;
  -- CHANGE THIS EMAIL TO YOUR LOGIN EMAIL
  v_email TEXT := 'admin@example.com'; 
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NOT NULL THEN
    -- Insert into user_roles as admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'User % (ID: %) set as admin successfully.', v_email, v_user_id;
  ELSE
    RAISE NOTICE 'User % not found in auth.users. Please sign up first.', v_email;
  END IF;
END $$;
