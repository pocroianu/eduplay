-- Child artifacts table with visibility lifecycle + audit log
-- Implements PRIVACY.md §7.1: content lifecycle and audit coverage for child artifacts

-- 1. Visibility enum matching PRIVACY.md §7.1 lifecycle:
--    draft → internal_teacher_only → family_visible → archived
CREATE TYPE visibility_status AS ENUM (
  'draft',
  'internal_teacher_only',
  'family_visible',
  'archived'
);

-- 2. Child artifacts table
-- Stores student-uploaded content (drawings, photos, audio, video)
-- that follows the teacher-review safeguarding model.
CREATE TABLE IF NOT EXISTS child_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES classes(id) ON DELETE SET NULL,
  title           TEXT,
  artifact_type   TEXT NOT NULL CHECK (artifact_type IN ('drawing', 'photo', 'audio', 'video', 'other')),
  storage_path    TEXT NOT NULL,
  visibility      visibility_status NOT NULL DEFAULT 'draft',
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_child_artifacts_student_id ON child_artifacts(student_id);
CREATE INDEX idx_child_artifacts_class_id ON child_artifacts(class_id);
CREATE INDEX idx_child_artifacts_visibility ON child_artifacts(visibility);

ALTER TABLE child_artifacts ENABLE ROW LEVEL SECURITY;

-- Teachers see artifacts from students in their classes
DROP POLICY IF EXISTS "Teachers can view class artifacts" ON child_artifacts;
CREATE POLICY "Teachers can view class artifacts" ON child_artifacts
  FOR SELECT USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- Teachers can insert artifacts on behalf of students in their classes
DROP POLICY IF EXISTS "Teachers can insert class artifacts" ON child_artifacts;
CREATE POLICY "Teachers can insert class artifacts" ON child_artifacts
  FOR INSERT WITH CHECK (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- Teachers can update artifacts in their classes (visibility changes, review)
DROP POLICY IF EXISTS "Teachers can update class artifacts" ON child_artifacts;
CREATE POLICY "Teachers can update class artifacts" ON child_artifacts
  FOR UPDATE USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- Teachers can delete artifacts in their classes
DROP POLICY IF EXISTS "Teachers can delete class artifacts" ON child_artifacts;
CREATE POLICY "Teachers can delete class artifacts" ON child_artifacts
  FOR DELETE USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- Students can view their own artifacts
DROP POLICY IF EXISTS "Students can view own artifacts" ON child_artifacts;
CREATE POLICY "Students can view own artifacts" ON child_artifacts
  FOR SELECT USING (auth.uid() = student_id);

-- Students can insert their own artifacts (always start as draft)
DROP POLICY IF EXISTS "Students can insert own artifacts" ON child_artifacts;
CREATE POLICY "Students can insert own artifacts" ON child_artifacts
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND visibility = 'draft'
  );

-- Parents can view family_visible artifacts for their children
CREATE OR REPLACE FUNCTION get_parent_child_ids(parent_uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM students WHERE parent_id = parent_uid;
$$;

DROP POLICY IF EXISTS "Parents can view family-visible artifacts" ON child_artifacts;
CREATE POLICY "Parents can view family-visible artifacts" ON child_artifacts
  FOR SELECT USING (
    visibility = 'family_visible'
    AND student_id IN (SELECT get_parent_child_ids(auth.uid()))
  );

-- Admins can manage all artifacts
DROP POLICY IF EXISTS "Admins can manage all artifacts" ON child_artifacts;
CREATE POLICY "Admins can manage all artifacts" ON child_artifacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS update_child_artifacts_updated_at ON child_artifacts;
CREATE TRIGGER update_child_artifacts_updated_at
  BEFORE UPDATE ON child_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 3. Audit log table
-- Records all state changes on child artifacts per PRIVACY.md §7.1
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role      TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('publish', 'delete', 'visibility_change', 'create')),
  artifact_id     UUID NOT NULL,
  artifact_table  TEXT NOT NULL DEFAULT 'child_artifacts',
  previous_state  JSONB,
  new_state       JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_artifact_id ON audit_log(artifact_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DROP POLICY IF EXISTS "Admins can view audit log" ON audit_log;
CREATE POLICY "Admins can view audit log" ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Teachers can view audit logs for artifacts in their classes
DROP POLICY IF EXISTS "Teachers can view class audit logs" ON audit_log;
CREATE POLICY "Teachers can view class audit logs" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM child_artifacts
      WHERE child_artifacts.id = audit_log.artifact_id
      AND child_artifacts.class_id IN (SELECT get_teacher_class_ids(auth.uid()))
    )
  );

-- Insert-only for the trigger function (SECURITY DEFINER)
-- No user-facing INSERT/UPDATE/DELETE policies — audit log is append-only via triggers


-- 4. Audit trigger function
CREATE OR REPLACE FUNCTION log_child_artifact_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_action TEXT;
  v_previous JSONB;
  v_new JSONB;
BEGIN
  -- Resolve actor from current session
  v_actor_id := auth.uid();
  SELECT role INTO v_actor_role FROM profiles WHERE id = v_actor_id;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_previous := NULL;
    v_new := jsonb_build_object(
      'visibility', NEW.visibility::text,
      'artifact_type', NEW.artifact_type,
      'student_id', NEW.student_id
    );

    INSERT INTO audit_log (actor_id, actor_role, action, artifact_id, previous_state, new_state)
    VALUES (v_actor_id, COALESCE(v_actor_role, 'unknown'), v_action, NEW.id, v_previous, v_new);

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log visibility changes
    IF OLD.visibility IS DISTINCT FROM NEW.visibility THEN
      IF NEW.visibility = 'family_visible' THEN
        v_action := 'publish';
      ELSE
        v_action := 'visibility_change';
      END IF;

      v_previous := jsonb_build_object('visibility', OLD.visibility::text);
      v_new := jsonb_build_object('visibility', NEW.visibility::text);

      INSERT INTO audit_log (actor_id, actor_role, action, artifact_id, previous_state, new_state)
      VALUES (v_actor_id, COALESCE(v_actor_role, 'unknown'), v_action, NEW.id, v_previous, v_new);
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_previous := jsonb_build_object(
      'visibility', OLD.visibility::text,
      'artifact_type', OLD.artifact_type,
      'student_id', OLD.student_id
    );
    v_new := NULL;

    INSERT INTO audit_log (actor_id, actor_role, action, artifact_id, previous_state, new_state)
    VALUES (v_actor_id, COALESCE(v_actor_role, 'unknown'), v_action, OLD.id, v_previous, v_new);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 5. Attach audit triggers to child_artifacts
DROP TRIGGER IF EXISTS audit_child_artifact_insert ON child_artifacts;
CREATE TRIGGER audit_child_artifact_insert
  AFTER INSERT ON child_artifacts
  FOR EACH ROW EXECUTE FUNCTION log_child_artifact_change();

DROP TRIGGER IF EXISTS audit_child_artifact_update ON child_artifacts;
CREATE TRIGGER audit_child_artifact_update
  AFTER UPDATE ON child_artifacts
  FOR EACH ROW EXECUTE FUNCTION log_child_artifact_change();

DROP TRIGGER IF EXISTS audit_child_artifact_delete ON child_artifacts;
CREATE TRIGGER audit_child_artifact_delete
  BEFORE DELETE ON child_artifacts
  FOR EACH ROW EXECUTE FUNCTION log_child_artifact_change();


-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260417100000''';
  END IF;
END
$wa$;
