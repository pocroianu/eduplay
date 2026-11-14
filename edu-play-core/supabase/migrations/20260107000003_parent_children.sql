-- Parent Portal: Multi-Parent Support via Junction Table
-- This migration creates the parent_children junction table to enable multiple parents per child
-- Maintains backward compatibility with existing students.parent_id column

-- 1. Create parent_children junction table
CREATE TABLE IF NOT EXISTS parent_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('mother', 'father', 'guardian', 'other')) DEFAULT 'guardian',
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_via_code UUID, -- References parent_invite_codes(id), added later
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_parent_student UNIQUE (parent_id, student_id)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON parent_children(parent_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_parent_children_student ON parent_children(student_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_parent_children_status ON parent_children(status);

-- 3. Migrate existing students.parent_id relationships to junction table
-- This preserves all existing parent-child links
INSERT INTO parent_children (parent_id, student_id, relationship_type, status)
SELECT parent_id, id, 'guardian', 'active'
FROM students
WHERE parent_id IS NOT NULL
ON CONFLICT (parent_id, student_id) DO NOTHING;

-- 4. Enable RLS on parent_children
ALTER TABLE parent_children ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for parent_children
-- Parents can view their child links
DROP POLICY IF EXISTS "Parents can view their child links" ON parent_children;
CREATE POLICY "Parents can view their child links" ON parent_children
  FOR SELECT USING (parent_id = auth.uid() AND status = 'active');

-- Parents can create new links (when using invite codes)
DROP POLICY IF EXISTS "Parents can link children" ON parent_children;
CREATE POLICY "Parents can link children" ON parent_children
  FOR INSERT WITH CHECK (parent_id = auth.uid());

-- Parents can revoke their own child links
DROP POLICY IF EXISTS "Parents can update their links" ON parent_children;
CREATE POLICY "Parents can update their links" ON parent_children
  FOR UPDATE USING (parent_id = auth.uid());

-- Teachers can view parent links for students in their classes
DROP POLICY IF EXISTS "Teachers can view parent links for their students" ON parent_children;
CREATE POLICY "Teachers can view parent links for their students" ON parent_children
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = parent_children.student_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- Teachers can create parent-child links for their students
DROP POLICY IF EXISTS "Teachers can create parent links for their students" ON parent_children;
CREATE POLICY "Teachers can create parent links for their students" ON parent_children
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = parent_children.student_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- 6. Add updated_at trigger
DROP TRIGGER IF EXISTS update_parent_children_updated_at ON parent_children;
CREATE TRIGGER update_parent_children_updated_at BEFORE UPDATE ON parent_children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Add comment for documentation
COMMENT ON TABLE parent_children IS 'Junction table enabling multiple parents per student (e.g., divorced parents, guardians). Replaces single parent_id foreign key in students table.';
COMMENT ON COLUMN parent_children.relationship_type IS 'Type of relationship: mother, father, guardian, or other';
COMMENT ON COLUMN parent_children.linked_via_code IS 'Foreign key to parent_invite_codes if linked via invite code';
COMMENT ON COLUMN parent_children.status IS 'Status of link: active or revoked';

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000003''';
  END IF;
END
$wa$;
