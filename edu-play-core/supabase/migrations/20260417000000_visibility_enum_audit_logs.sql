-- EDU-23: Visibility enum + audit log infrastructure
-- Reference: PRIVACY.md §7.1

-- 1. Content visibility enum (for child-facing content)
-- Used by current and future tables that surface content to families.
-- The `is_published` boolean on games/activities is a catalog concern;
-- this enum is the GDPR-relevant visibility control for child artifacts.
DO $$ BEGIN
  CREATE TYPE content_visibility AS ENUM (
    'draft',
    'internal_teacher_only',
    'family_visible',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
  ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
  ON audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by
  ON audit_logs(changed_by);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 3. Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_uuid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    record_uuid := OLD.id;
    INSERT INTO audit_logs (table_name, record_id, operation, old_data, changed_by)
    VALUES (TG_TABLE_NAME, record_uuid, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    record_uuid := NEW.id;
    INSERT INTO audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, record_uuid, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    record_uuid := NEW.id;
    INSERT INTO audit_logs (table_name, record_id, operation, new_data, changed_by)
    VALUES (TG_TABLE_NAME, record_uuid, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Attach audit triggers to child-data tables
-- These are the tables that hold or affect child (student) data.

-- students: profile changes, class reassignment, deletion
DROP TRIGGER IF EXISTS audit_students ON students;
CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- game_progress: score changes, completion, deletion
DROP TRIGGER IF EXISTS audit_game_progress ON game_progress;
CREATE TRIGGER audit_game_progress
  AFTER INSERT OR UPDATE OR DELETE ON game_progress
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- assignments: teacher assigns/modifies/removes work for students
DROP TRIGGER IF EXISTS audit_assignments ON assignments;
CREATE TRIGGER audit_assignments
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- activities: visibility/publish changes on child-accessible content
DROP TRIGGER IF EXISTS audit_activities ON activities;
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260417000000''';
  END IF;
END
$wa$;
