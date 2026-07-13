-- Create enum for department
DO $$ BEGIN
    CREATE TYPE public.department AS ENUM (
        'BSIS',
        'BPA',
        'BTVTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for fine status
DO $$ BEGIN
    CREATE TYPE public.fine_status AS ENUM ('Paid', 'Pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for fine types
DO $$ BEGIN
    CREATE TYPE public.fine_type AS ENUM (
        'Not wearing ID',
        'Late enrollment',
        'Library fine',
        'Laboratory damage',
        'Dress code violation',
        'Unauthorized absence',
        'Property damage',
        'Other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for gender
DO $$ BEGIN
    CREATE TYPE public.gender_type AS ENUM ('Male', 'Female', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for user roles
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 15 AND age <= 100),
  address TEXT,
  gender public.gender_type NOT NULL,
  department public.department NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fines table
CREATE TABLE IF NOT EXISTS public.fines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fine_type public.fine_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  balance DECIMAL(10, 2) NOT NULL CHECK (balance >= 0),
  status public.fine_status NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create CSC officers table
CREATE TABLE IF NOT EXISTS public.csc_officers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  photo_url TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles table for admin access
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  UNIQUE (user_id, role)
);

-- Create transactions table for tracking fine records
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fine_id UUID NOT NULL REFERENCES public.fines(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL CHECK (amount_paid > 0),
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csc_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create helper function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for students table
DO $$ BEGIN
    CREATE POLICY "Admins can view all students"
      ON public.students FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Students can view their own profile"
      ON public.students FOR SELECT
      TO authenticated
      USING (
        student_id = (
          SELECT student_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
        )::VARCHAR
      );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for fines table
DO $$ BEGIN
    CREATE POLICY "Admins can view all fines"
      ON public.fines FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Students can view their own fines"
      ON public.fines FOR SELECT
      TO authenticated
      USING (
        student_id = (
          SELECT student_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
        )
      );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for csc_officers table
DO $$ BEGIN
    CREATE POLICY "Public can view officers"
      ON public.csc_officers FOR SELECT
      TO anon, authenticated
      USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage officers"
      ON public.csc_officers FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for user_roles table
DO $$ BEGIN
    CREATE POLICY "Admins can view user roles"
      ON public.user_roles FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view their own role"
      ON public.user_roles FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for transactions table
DO $$ BEGIN
    CREATE POLICY "Admins can view all transactions"
      ON public.transactions FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Students can view their own transactions"
      ON public.transactions FOR SELECT
      TO authenticated
      USING (
        fine_id IN (
          SELECT id FROM public.fines 
          WHERE student_id = (
            SELECT student_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
          )
        )
      );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DO $$ BEGIN
    CREATE TRIGGER update_students_updated_at
      BEFORE UPDATE ON public.students
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_fines_updated_at
      BEFORE UPDATE ON public.fines
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Insert sample CSC officers
INSERT INTO public.csc_officers (name, position, description, display_order, photo_url) VALUES
  ('Maria Santos', 'President', 'Leading the CSC with dedication and vision for student welfare.', 1, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop'),
  ('Juan Dela Cruz', 'Vice President', 'Supporting student initiatives and community building.', 2, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop'),
  ('Ana Reyes', 'Secretary', 'Managing records and ensuring smooth CSC operations.', 3, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop'),
  ('Pedro Garcia', 'Treasurer', 'Handling finances with transparency and accountability.', 4, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop'),
  ('Elena Cruz', 'Auditor', 'Ensuring financial integrity and proper fund management.', 5, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop'),
  ('Carlos Mendoza', 'P.R.O.', 'Bridging communication between students and administration.', 6, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop');