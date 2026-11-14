-- Link activity instances created from a learning-path step back to the
-- source step so student relaunches are idempotent without broadening RLS.

ALTER TABLE activity_instances
  ADD COLUMN IF NOT EXISTS source_learning_path_step_id UUID
    REFERENCES learning_path_steps(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_instances_source_step_assigned_to_unique
  ON activity_instances(source_learning_path_step_id, assigned_to)
  WHERE source_learning_path_step_id IS NOT NULL;
