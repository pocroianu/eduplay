-- Parent Portal: Invite Code System
-- This migration creates the parent_invite_codes table for secure parent-child linking
-- Teachers generate invite codes, parents use them to link to their children

-- 1. Create parent_invite_codes table
CREATE TABLE IF NOT EXISTS parent_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL, -- bcrypt hash of the invite code (never store plain text)
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES profiles(id), -- Parent who used this code
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_student ON parent_invite_codes(student_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_teacher ON parent_invite_codes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires ON parent_invite_codes(expires_at)
  WHERE used_at IS NULL AND is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by ON parent_invite_codes(used_by);

-- 3. Enable RLS on parent_invite_codes
ALTER TABLE parent_invite_codes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for parent_invite_codes
-- Teachers can view invite codes for their students
DROP POLICY IF EXISTS "Teachers can view codes for their students" ON parent_invite_codes;
CREATE POLICY "Teachers can view codes for their students" ON parent_invite_codes
  FOR SELECT USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = parent_invite_codes.student_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- Teachers can create invite codes for their students
DROP POLICY IF EXISTS "Teachers can create invite codes" ON parent_invite_codes;
CREATE POLICY "Teachers can create invite codes" ON parent_invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = parent_invite_codes.student_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- Teachers can update (revoke) their own invite codes
DROP POLICY IF EXISTS "Teachers can update their codes" ON parent_invite_codes;
CREATE POLICY "Teachers can update their codes" ON parent_invite_codes
  FOR UPDATE USING (
    teacher_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM students
      JOIN classes ON students.class_id = classes.id
      WHERE students.id = parent_invite_codes.student_id
      AND classes.teacher_id = auth.uid()
    )
  );

-- Parents can view codes they used (for audit trail)
DROP POLICY IF EXISTS "Parents can view codes they used" ON parent_invite_codes;
CREATE POLICY "Parents can view codes they used" ON parent_invite_codes
  FOR SELECT USING (used_by = auth.uid());

-- 5. Add foreign key constraint to parent_children.linked_via_code
-- (Now that parent_invite_codes exists)
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_parent_children_invite_code'
    AND table_name = 'parent_children'
  ) THEN
    ALTER TABLE parent_children
      ADD CONSTRAINT fk_parent_children_invite_code
      FOREIGN KEY (linked_via_code) REFERENCES parent_invite_codes(id) ON DELETE SET NULL;
  END IF;
END
$fk$;

-- 6. Add comment for documentation
COMMENT ON TABLE parent_invite_codes IS 'Secure invite codes for parent-child linking. Codes are hashed (bcrypt) and expire after 7 days.';
COMMENT ON COLUMN parent_invite_codes.code_hash IS 'bcrypt hash of the 8-character invite code (never store plain text)';
COMMENT ON COLUMN parent_invite_codes.expires_at IS 'Expiration timestamp (default: 7 days from creation)';
COMMENT ON COLUMN parent_invite_codes.used_at IS 'Timestamp when code was used to link parent to child';
COMMENT ON COLUMN parent_invite_codes.used_by IS 'Parent profile ID who used this code';
COMMENT ON COLUMN parent_invite_codes.is_revoked IS 'Whether code was manually revoked by teacher before use';

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000004''';
  END IF;
END
$wa$;
