-- F9 Phase 1A.1 (EDU-302): durable per-instance outcome bag for activity
-- types. 1B (Drawing Canvas) and 1C (Voice Recording) both need a place to
-- store result metadata (final artifact id, completion time, attempts, ...);
-- adding the column up-front avoids a migration train when those types ship.
-- Each registered type owns its own shape under a registry-scoped key inside
-- the JSONB payload — the column is intentionally schemaless at the DB
-- level.

ALTER TABLE activity_instances
  ADD COLUMN IF NOT EXISTS result_summary JSONB;
