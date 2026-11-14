-- Fix RLS policy for students table
-- Run this in Supabase SQL Editor

-- Drop existing SELECT policies for students
DROP POLICY IF EXISTS "Students can view own profile" ON students;
DROP POLICY IF EXISTS "Teachers can view their class students" ON students;
DROP POLICY IF EXISTS "Parents can view their children" ON students;

-- Create new comprehensive SELECT policy
-- Teachers can view: students in their classes OR students with no class (unassigned)
CREATE POLICY "Students can view own profile" ON students
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Teachers can view students" ON students;
CREATE POLICY "Teachers can view students" ON students
  FOR SELECT USING (
    -- Student is in one of teacher's classes
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
    OR
    -- Student has no class assigned (for MVP, all teachers can see unassigned students)
    students.class_id IS NULL
  );

DROP POLICY IF EXISTS "Parents can view their children" ON students;
CREATE POLICY "Parents can view their children" ON students
  FOR SELECT USING (auth.uid() = parent_id);

-- Also fix INSERT policy to allow creating students without a class
DROP POLICY IF EXISTS "Teachers can insert students" ON students;

DROP POLICY IF EXISTS "Teachers can insert students" ON students;
CREATE POLICY "Teachers can insert students" ON students
  FOR INSERT WITH CHECK (
    -- Teacher is inserting into their own class
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
    OR
    -- Or inserting a student without a class (will be assigned later)
    students.class_id IS NULL
    OR
    -- Or using service role (admin client)
    auth.role() = 'service_role'
  );

-- Fix UPDATE policy to allow teachers to update unassigned students
DROP POLICY IF EXISTS "Teachers can update their class students" ON students;

DROP POLICY IF EXISTS "Teachers can update students" ON students;
CREATE POLICY "Teachers can update students" ON students
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = auth.uid()
    )
    OR
    students.class_id IS NULL
  );

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000002''';
  END IF;
END
$wa$;
