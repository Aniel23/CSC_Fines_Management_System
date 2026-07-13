-- Populate departments with existing academic departments
-- This script adds the departments that are referenced in student data

INSERT INTO public.departments (name, description, head_of_department, office_location, contact_email) VALUES
('Bachelor of Science in Information Systems', 'BSIS department focusing on information systems and technology management', 'Dr. Maria Santos', 'Building A, Room 101', 'bsis@university.edu'),
('Bachelor of Technical-Vocational Teacher Education', 'BTVTED department for technical and vocational education', 'Dr. Jose Reyes', 'Building B, Room 205', 'btvted@university.edu'),
('Bachelor of Public Administration', 'BPA department for public administration and governance', 'Dr. Juan Cruz', 'Building C, Room 150', 'bpa@university.edu')
ON CONFLICT (name) DO NOTHING;

-- Update existing departments if they already exist
UPDATE public.departments SET 
  description = CASE 
    WHEN name = 'Bachelor of Science in Information Systems' THEN 'BSIS department focusing on information systems and technology management'
    WHEN name = 'Bachelor of Technical-Vocational Teacher Education' THEN 'BTVTED department for technical and vocational education'
    WHEN name = 'Bachelor of Public Administration' THEN 'BPA department for public administration and governance'
    ELSE description
  END,
  head_of_department = CASE 
    WHEN name = 'Bachelor of Science in Information Systems' THEN 'Dr. Maria Santos'
    WHEN name = 'Bachelor of Technical-Vocational Teacher Education' THEN 'Dr. Jose Reyes'
    WHEN name = 'Bachelor of Public Administration' THEN 'Dr. Juan Cruz'
    ELSE head_of_department
  END,
  office_location = CASE 
    WHEN name = 'Bachelor of Science in Information Systems' THEN 'Building A, Room 101'
    WHEN name = 'Bachelor of Technical-Vocational Teacher Education' THEN 'Building B, Room 205'
    WHEN name = 'Bachelor of Public Administration' THEN 'Building C, Room 150'
    ELSE office_location
  END,
  contact_email = CASE 
    WHEN name = 'Bachelor of Science in Information Systems' THEN 'bsis@university.edu'
    WHEN name = 'Bachelor of Technical-Vocational Teacher Education' THEN 'btvted@university.edu'
    WHEN name = 'Bachelor of Public Administration' THEN 'bpa@university.edu'
    ELSE contact_email
  END,
  updated_at = NOW()
WHERE name IN ('Bachelor of Science in Information Systems', 'Bachelor of Technical-Vocational Teacher Education', 'Bachelor of Public Administration');
