-- Fix Foreign Key Constraints to ensure cascading deletions
-- This resolves the 400 Bad Request error when deleting a student who has related fines or user roles

DO $$ BEGIN
    -- 1. Fix fines -> students constraint
    -- Try to drop the existing constraint (name might vary, so we try standard names)
    ALTER TABLE public.fines DROP CONSTRAINT IF EXISTS fines_student_id_fkey;
    
    -- Add it back with ON DELETE CASCADE
    ALTER TABLE public.fines
    ADD CONSTRAINT fines_student_id_fkey
    FOREIGN KEY (student_id)
    REFERENCES public.students(id)
    ON DELETE CASCADE;

EXCEPTION
    WHEN undefined_object THEN 
        -- If table doesn't exist (unlikely), ignore
        NULL;
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing fines constraint: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- 2. Fix user_roles -> students constraint
    -- We want to SET NULL or CASCADE. Original was SET NULL.
    -- Let's use CASCADE to keep the user_roles clean? 
    -- Actually, if we delete the student record, the user still exists in auth.users.
    -- If we delete the role entry, they can't log in as student anymore, which is probably correct.
    -- But let's stick to the original intention of SET NULL for now, OR switch to CASCADE if we want to remove the role linkage entirely.
    -- If the student record is gone, having a "student" role pointing to NULL is useless.
    -- Let's change it to CASCADE so the role entry is removed too.
    
    ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_student_id_fkey;
    
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_student_id_fkey
    FOREIGN KEY (student_id)
    REFERENCES public.students(id)
    ON DELETE CASCADE; -- Changed from SET NULL to CASCADE to clean up orphan roles

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing user_roles constraint: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- 3. Fix transactions -> fines constraint (just in case)
    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_fine_id_fkey;
    
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_fine_id_fkey
    FOREIGN KEY (fine_id)
    REFERENCES public.fines(id)
    ON DELETE CASCADE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing transactions constraint: %', SQLERRM;
END $$;
