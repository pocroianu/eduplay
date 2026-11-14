-- Parent Portal: Additional RLS Policies
-- This migration adds missing RLS policies to enable parent access to existing tables
-- CRITICAL FIX: Parents cannot currently access child progress/assignments due to missing policies

-- 1. Add RLS policies for parents to view game_progress
-- Parents can view their children's game progress (via both junction table and legacy parent_id)
DROP POLICY IF EXISTS "Parents can view their children's game progress" ON game_progress;
CREATE POLICY "Parents can view their children's game progress" ON game_progress
  FOR SELECT USING (
    -- Check parent_children junction table
    student_id IN (
      SELECT student_id FROM parent_children
      WHERE parent_id = auth.uid() AND status = 'active'
    )
    -- Also check legacy students.parent_id for backward compatibility
    OR student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  );

-- 2. Add RLS policies for parents to view assignments
-- Parents can view assignments for their children (both individual and class-wide)
DROP POLICY IF EXISTS "Parents can view their children's assignments" ON assignments;
CREATE POLICY "Parents can view their children's assignments" ON assignments
  FOR SELECT USING (
    -- Individual student assignments
    student_id IN (
      SELECT student_id FROM parent_children
      WHERE parent_id = auth.uid() AND status = 'active'
    )
    OR student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
    -- Class-wide assignments for children's classes
    OR class_id IN (
      SELECT s.class_id FROM students s
      JOIN parent_children pc ON s.id = pc.student_id
      WHERE pc.parent_id = auth.uid() AND pc.status = 'active' AND s.class_id IS NOT NULL
    )
    OR class_id IN (
      SELECT class_id FROM students
      WHERE parent_id = auth.uid() AND class_id IS NOT NULL
    )
  );

-- 3. Add RLS policies for parents to view classes their children belong to
-- Parents need to see class information to understand context
DROP POLICY IF EXISTS "Parents can view classes their children belong to" ON classes;
CREATE POLICY "Parents can view classes their children belong to" ON classes
  FOR SELECT USING (
    id IN (
      SELECT s.class_id FROM students s
      JOIN parent_children pc ON s.id = pc.student_id
      WHERE pc.parent_id = auth.uid() AND pc.status = 'active' AND s.class_id IS NOT NULL
    )
    OR id IN (
      SELECT class_id FROM students
      WHERE parent_id = auth.uid() AND class_id IS NOT NULL
    )
  );

-- 4. Add RLS policy for parents to view games their children have played
-- Parents should see all published games (already allowed), but this makes it explicit
-- No additional policy needed - "Anyone can view published games" already exists

-- 5. Update students table RLS to support junction table
-- Allow parents to view students via junction table (in addition to existing parent_id policy)
DROP POLICY IF EXISTS "Parents can view their children via junction table" ON students;
CREATE POLICY "Parents can view their children via junction table" ON students
  FOR SELECT USING (
    id IN (
      SELECT student_id FROM parent_children
      WHERE parent_id = auth.uid() AND status = 'active'
    )
  );

-- 6. Add comments for documentation
COMMENT ON POLICY "Parents can view their children's game progress" ON game_progress IS 'Allows parents to view game progress for children linked via parent_children or students.parent_id';
COMMENT ON POLICY "Parents can view their children's assignments" ON assignments IS 'Allows parents to view assignments for their children (individual and class-wide)';
COMMENT ON POLICY "Parents can view classes their children belong to" ON classes IS 'Allows parents to view class information for classes their children are enrolled in';
COMMENT ON POLICY "Parents can view their children via junction table" ON students IS 'Allows parents to view student profiles linked via parent_children junction table';

-- 7. Verification queries (commented out - for manual testing)
-- Test as parent user:
-- SELECT * FROM game_progress WHERE student_id = 'child-uuid'; -- Should return child's progress
-- SELECT * FROM assignments WHERE student_id = 'child-uuid'; -- Should return child's assignments
-- SELECT * FROM classes WHERE id = 'class-uuid'; -- Should return class if child is enrolled
-- SELECT * FROM students WHERE id = 'child-uuid'; -- Should return child's profile

-- Test as parent user with NO access:
-- SELECT * FROM game_progress WHERE student_id = 'other-child-uuid'; -- Should return 0 rows
-- SELECT * FROM assignments WHERE student_id = 'other-child-uuid'; -- Should return 0 rows

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000007''';
  END IF;
END
$wa$;
