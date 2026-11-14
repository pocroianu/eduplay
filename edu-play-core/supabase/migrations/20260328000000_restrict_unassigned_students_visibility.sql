-- Restrict unassigned students visibility
--
-- Previously, ALL teachers could SELECT students with class_id IS NULL.
-- This leaks student data across organizational boundaries in multi-school
-- deployments. Teachers should only see students in their own classes.
--
-- The INSERT and UPDATE policies still allow class_id IS NULL so teachers
-- can create students before assigning them to a class (the student creation
-- flow creates the student, then assigns the class in a follow-up step).
-- However, after creation, teachers can only see/update students in their classes.
--
-- Note: The API route for student creation uses the service_role client,
-- which bypasses RLS entirely, so INSERT policy is only relevant for
-- direct Supabase client usage.

-- Fix SELECT: remove blanket class_id IS NULL visibility
DROP POLICY IF EXISTS "Teachers can view students" ON students;
CREATE POLICY "Teachers can view students" ON students
  FOR SELECT USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- Fix UPDATE: remove blanket class_id IS NULL (teacher must own the class)
DROP POLICY IF EXISTS "Teachers can update students" ON students;
CREATE POLICY "Teachers can update students" ON students
  FOR UPDATE USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- INSERT: keep class_id IS NULL to allow creating unassigned students
-- (no change to INSERT policy — it already allows NULL or owned class)

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260328000000''';
  END IF;
END
$wa$;
