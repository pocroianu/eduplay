-- EduPlay România - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (created in 00-init-roles.sql)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'parent', 'student', 'admin')),
  avatar_url TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can insert profile during signup" ON profiles;
CREATE POLICY "Anyone can insert profile during signup" ON profiles
  FOR INSERT WITH CHECK (true);

-- Function to handle new user signup - auto-creates profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  grade_level TEXT CHECK (grade_level IN ('preschool', 'kindergarten', 'grade-1', 'grade-2')),
  school_year TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own classes" ON classes;
CREATE POLICY "Teachers can view own classes" ON classes
  FOR SELECT USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can create classes" ON classes;
CREATE POLICY "Teachers can create classes" ON classes
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update own classes" ON classes;
CREATE POLICY "Teachers can update own classes" ON classes
  FOR UPDATE USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete own classes" ON classes;
CREATE POLICY "Teachers can delete own classes" ON classes
  FOR DELETE USING (auth.uid() = teacher_id);

-- 3. Students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own profile" ON students;
CREATE POLICY "Students can view own profile" ON students
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Teachers can view their class students" ON students;
CREATE POLICY "Teachers can view their class students" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can insert students" ON students;
CREATE POLICY "Teachers can insert students" ON students
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
    OR students.class_id IS NULL
  );

DROP POLICY IF EXISTS "Teachers can update their class students" ON students;
CREATE POLICY "Teachers can update their class students" ON students
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents can view their children" ON students;
CREATE POLICY "Parents can view their children" ON students
  FOR SELECT USING (auth.uid() = parent_id);

-- 4. Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  game_url TEXT NOT NULL,
  category TEXT CHECK (category IN ('literacy', 'math', 'phonics', 'shapes', 'colors', 'vocabulary')),
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  target_age_min INTEGER,
  target_age_max INTEGER,
  estimated_duration INTEGER,
  learning_objectives JSONB,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for games
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published games" ON games;
CREATE POLICY "Anyone can view published games" ON games
  FOR SELECT USING (is_published = TRUE);

DROP POLICY IF EXISTS "Admins can manage games" ON games;
CREATE POLICY "Admins can manage games" ON games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 5. Game Progress table
CREATE TABLE IF NOT EXISTS game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  score INTEGER,
  time_spent INTEGER,
  attempts INTEGER DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, game_id)
);

-- RLS for game_progress
ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own progress" ON game_progress;
CREATE POLICY "Students can view own progress" ON game_progress
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own progress" ON game_progress;
CREATE POLICY "Students can insert own progress" ON game_progress
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own progress" ON game_progress;
CREATE POLICY "Students can update own progress" ON game_progress
  FOR UPDATE USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view student progress in their classes" ON game_progress;
CREATE POLICY "Teachers can view student progress in their classes" ON game_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = game_progress.student_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- 6. Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  is_mandatory BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (class_id IS NOT NULL OR student_id IS NOT NULL)
);

-- RLS for assignments
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage assignments" ON assignments;
CREATE POLICY "Teachers can manage assignments" ON assignments
  FOR ALL USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Students can view their assignments" ON assignments;
CREATE POLICY "Students can view their assignments" ON assignments
  FOR SELECT USING (
    auth.uid() = student_id OR
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.class_id = assignments.class_id
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_game_progress_student_id ON game_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_game_progress_game_id ON game_progress(game_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student_id ON assignments(student_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_progress_updated_at ON game_progress;
CREATE TRIGGER update_game_progress_updated_at BEFORE UPDATE ON game_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample games for testing
INSERT INTO games (title, description, game_url, category, difficulty_level, target_age_min, target_age_max, estimated_duration, is_published) VALUES
  ('Litera A', 'Învață litera A și sunetul ei', '/games/letter-a/index.html', 'literacy', 1, 3, 5, 5, true),
  ('Litera B', 'Învață litera B și sunetul ei', '/games/letter-b/index.html', 'literacy', 1, 3, 5, 5, true),
  ('Numere 1-5', 'Învață să numeri de la 1 la 5', '/games/numbers-1-5/index.html', 'math', 1, 3, 5, 5, true),
  ('Numere 1-10', 'Învață să numeri de la 1 la 10', '/games/numbers-1-10/index.html', 'math', 2, 4, 6, 7, true),
  ('Forme Geometrice', 'Învață formele: cerc, pătrat, triunghi', '/games/shapes/index.html', 'shapes', 1, 3, 5, 5, true),
  ('Culorile', 'Învață culorile de bază', '/games/colors/index.html', 'colors', 1, 3, 5, 5, true),
  ('Animale', 'Învață numele animalelor', '/games/animals/index.html', 'vocabulary', 2, 4, 6, 7, true),
  ('Fructe și Legume', 'Învață fructele și legumele', '/games/fruits-vegetables/index.html', 'vocabulary', 2, 4, 6, 7, true)
ON CONFLICT DO NOTHING;

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove any pre-existing tracking row so the CLI's final INSERT can succeed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000000''';
  END IF;
END $$;

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000000''';
  END IF;
END
$wa$;
