-- Remove previously imported or stale department data before re-seeding.
DELETE FROM public.departments
WHERE name IN (
  'Bachelor of Science in Information Systems',
  'Bachelor of Technical-Vocational Teacher Education',
  'Bachelor of Public Administration',
  'BSIS',
  'BTVTED',
  'BPA'
);

-- Populate departments with the same canonical names used by student records.
-- This keeps student.department values and department metadata aligned.
INSERT INTO public.departments (name, description, head_of_department, office_location, contact_email) VALUES
('BSIS', 'Bachelor of Science in Information Systems department', 'Dr. Maria Santos', 'Building A, Room 101', 'bsis@university.edu'),
('BTVTED', 'Bachelor of Technical-Vocational Teacher Education department', 'Dr. Jose Reyes', 'Building B, Room 205', 'btvted@university.edu'),
('BPA', 'Bachelor of Public Administration department', 'Dr. Juan Cruz', 'Building C, Room 150', 'bpa@university.edu')
ON CONFLICT (name) DO NOTHING;

-- Update existing department metadata if a row already exists.
UPDATE public.departments SET 
  description = CASE 
    WHEN name = 'BSIS' THEN 'Bachelor of Science in Information Systems department'
    WHEN name = 'BTVTED' THEN 'Bachelor of Technical-Vocational Teacher Education department'
    WHEN name = 'BPA' THEN 'Bachelor of Public Administration department'
    ELSE description
  END,
  head_of_department = CASE 
    WHEN name = 'BSIS' THEN 'Dr. Maria Santos'
    WHEN name = 'BTVTED' THEN 'Dr. Jose Reyes'
    WHEN name = 'BPA' THEN 'Dr. Juan Cruz'
    ELSE head_of_department
  END,
  office_location = CASE 
    WHEN name = 'BSIS' THEN 'Building A, Room 101'
    WHEN name = 'BTVTED' THEN 'Building B, Room 205'
    WHEN name = 'BPA' THEN 'Building C, Room 150'
    ELSE office_location
  END,
  contact_email = CASE 
    WHEN name = 'BSIS' THEN 'bsis@university.edu'
    WHEN name = 'BTVTED' THEN 'btvted@university.edu'
    WHEN name = 'BPA' THEN 'bpa@university.edu'
    ELSE contact_email
  END,
  updated_at = NOW()
WHERE name IN ('BSIS', 'BTVTED', 'BPA');
