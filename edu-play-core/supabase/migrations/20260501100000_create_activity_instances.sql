-- F9 Phase 1A: activity instances table for creative activity types
-- (drawing canvas, voice recording). The catalog of types is code-side via
-- the `features/activities/registry` module; this table only stores the
-- per-student instances that students play and that teachers later attach
-- artifacts/results to.

CREATE TABLE IF NOT EXISTS activity_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id       TEXT NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id      UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_instances_assigned_to ON activity_instances(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activity_instances_class_id    ON activity_instances(class_id);
CREATE INDEX IF NOT EXISTS idx_activity_instances_created_by  ON activity_instances(created_by);
CREATE INDEX IF NOT EXISTS idx_activity_instances_type_id     ON activity_instances(type_id);

ALTER TABLE activity_instances ENABLE ROW LEVEL SECURITY;

-- Teachers can manage activity_instances they created OR that target one of
-- their classes. Mirrors the `assignments` policy shape so the auth model is
-- predictable for teachers.
DROP POLICY IF EXISTS "Teachers can manage own activity_instances" ON activity_instances;
CREATE POLICY "Teachers can manage own activity_instances" ON activity_instances
  FOR ALL USING (
    auth.uid() = created_by
    OR class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

-- Students can view activity_instances assigned to them.
DROP POLICY IF EXISTS "Students can view assigned activity_instances" ON activity_instances;
CREATE POLICY "Students can view assigned activity_instances" ON activity_instances
  FOR SELECT USING (auth.uid() = assigned_to);

-- Admins manage everything (matches other safeguarded tables).
DROP POLICY IF EXISTS "Admins can manage all activity_instances" ON activity_instances;
CREATE POLICY "Admins can manage all activity_instances" ON activity_instances
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS update_activity_instances_updated_at ON activity_instances;
CREATE TRIGGER update_activity_instances_updated_at
  BEFORE UPDATE ON activity_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
