-- Fix: infinite recursion between RLS policies on classes, students, parent_children, profiles
--
-- Multiple circular dependencies exist:
--   classes → students → classes (teacher/parent policies)
--   students → parent_children → students (junction table policies)
--   profiles → students → parent_children → students (teacher profile policy)
--
-- Solution: Use SECURITY DEFINER helper functions that bypass RLS for all
-- cross-table lookups, breaking every cycle.

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER = bypass RLS, breaking cycles)
-- ============================================================================

-- Returns class IDs owned by a teacher (bypasses classes RLS)
CREATE OR REPLACE FUNCTION get_teacher_class_ids(teacher_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT id FROM public.classes WHERE teacher_id = teacher_uuid;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Returns student IDs in a teacher's classes (bypasses students + classes RLS)
CREATE OR REPLACE FUNCTION get_teacher_student_ids(teacher_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT s.id FROM public.students s
  WHERE s.class_id IN (SELECT id FROM public.classes WHERE teacher_id = teacher_uuid);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Returns class IDs for a parent's children (bypasses students + parent_children RLS)
CREATE OR REPLACE FUNCTION get_parent_student_class_ids(parent_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT s.class_id
  FROM public.students s
  LEFT JOIN public.parent_children pc ON s.id = pc.student_id
  WHERE s.class_id IS NOT NULL
    AND (
      (pc.parent_id = parent_uuid AND pc.status = 'active')
      OR s.parent_id = parent_uuid
    );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Returns student IDs linked to a parent (bypasses students + parent_children RLS)
CREATE OR REPLACE FUNCTION get_parent_student_ids(parent_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT s.id
  FROM public.students s
  LEFT JOIN public.parent_children pc ON s.id = pc.student_id
  WHERE (pc.parent_id = parent_uuid AND pc.status = 'active')
     OR s.parent_id = parent_uuid;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- ============================================================================
-- CLASSES POLICIES
-- ============================================================================

-- Fix: parent classes policy was querying students directly → cycle
DROP POLICY IF EXISTS "Parents can view classes their children belong to" ON classes;
CREATE POLICY "Parents can view classes their children belong to" ON classes
  FOR SELECT USING (
    id IN (SELECT get_parent_student_class_ids(auth.uid()))
  );

-- ============================================================================
-- STUDENTS POLICIES
-- ============================================================================

-- Fix: teacher students policy was querying classes directly → cycle
DROP POLICY IF EXISTS "Teachers can view students" ON students;
CREATE POLICY "Teachers can view students" ON students
  FOR SELECT USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
    OR class_id IS NULL
  );

DROP POLICY IF EXISTS "Teachers can insert students" ON students;
CREATE POLICY "Teachers can insert students" ON students
  FOR INSERT WITH CHECK (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
    OR class_id IS NULL
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Teachers can update students" ON students;
CREATE POLICY "Teachers can update students" ON students
  FOR UPDATE USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
    OR class_id IS NULL
  );

-- Fix: parent junction policy was querying parent_children which queries students → cycle
DROP POLICY IF EXISTS "Parents can view their children via junction table" ON students;
CREATE POLICY "Parents can view their children via junction table" ON students
  FOR SELECT USING (
    id IN (SELECT get_parent_student_ids(auth.uid()))
  );

-- ============================================================================
-- PARENT_CHILDREN POLICIES
-- ============================================================================

-- Fix: teacher parent_children policies were querying students + classes → cycle
DROP POLICY IF EXISTS "Teachers can view parent links for their students" ON parent_children;
CREATE POLICY "Teachers can view parent links for their students" ON parent_children
  FOR SELECT USING (
    student_id IN (SELECT get_teacher_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Teachers can create parent links for their students" ON parent_children;
CREATE POLICY "Teachers can create parent links for their students" ON parent_children
  FOR INSERT WITH CHECK (
    student_id IN (SELECT get_teacher_student_ids(auth.uid()))
  );

-- ============================================================================
-- GAME_PROGRESS POLICIES
-- ============================================================================

-- Fix: teacher game_progress policy was querying students + classes → cycle
DROP POLICY IF EXISTS "Teachers can view student progress in their classes" ON game_progress;
CREATE POLICY "Teachers can view student progress in their classes" ON game_progress
  FOR SELECT USING (
    student_id IN (SELECT get_teacher_student_ids(auth.uid()))
  );

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Add: teachers need to see student profiles for dashboard (names, avatars)
-- Currently profiles only allows auth.uid() = id
DROP POLICY IF EXISTS "Teachers can view student profiles" ON profiles;
CREATE POLICY "Teachers can view student profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR id IN (SELECT get_teacher_student_ids(auth.uid()))
  );

-- Add: parents need to see their children's profiles
DROP POLICY IF EXISTS "Parents can view children profiles" ON profiles;
CREATE POLICY "Parents can view children profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR id IN (SELECT get_parent_student_ids(auth.uid()))
  );

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260327000001''';
  END IF;
END
$wa$;
