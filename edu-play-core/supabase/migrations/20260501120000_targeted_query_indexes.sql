-- EDU-37: targeted indexes for hot read paths and unindexed FKs.
--
-- Audit notes:
--   * Initial schema covered single-column indexes for the obvious lookup
--     keys (e.g. game_progress.student_id). Several read paths added since
--     then sort or filter on additional columns and currently fall back to
--     index-then-sort or seq scans.
--   * A few foreign keys never had indexes, which causes slow ON DELETE
--     CASCADE work and seq scans for parent-portal queries.
--
-- See PR description for the per-query rationale.

-- 1. Foreign keys that never received an index ------------------------------

-- Parent dashboard + admin/users[id] (`students.parent_id`) and
-- get_parent_child_ids() RLS helper. Partial because most rows have
-- parent_id IS NULL today (link is via parent_children).
CREATE INDEX IF NOT EXISTS idx_students_parent_id
  ON students(parent_id)
  WHERE parent_id IS NOT NULL;

-- assignments.game_id is an FK with ON DELETE CASCADE. Without an index,
-- deleting a game forces a seq scan over assignments to find dependents.
CREATE INDEX IF NOT EXISTS idx_assignments_game_id
  ON assignments(game_id);

-- child_artifacts.reviewed_by FK; without it, ON DELETE SET NULL on a
-- profile deletion does a seq scan. Partial because most rows are NULL.
CREATE INDEX IF NOT EXISTS idx_child_artifacts_reviewed_by
  ON child_artifacts(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

-- 2. game_progress hot path: dashboard "recent activity" lists --------------
-- Queries: features/parent-portal/queries/get-recent-activity.ts,
--          features/teacher-dashboard/queries/get-class-students.ts,
--          app/api/v1/progress/route.ts
-- Pattern: WHERE student_id = $1  (or IN (...))  ORDER BY last_played_at DESC
-- Existing idx_game_progress_student_id forces a sort step after lookup.
CREATE INDEX IF NOT EXISTS idx_game_progress_student_last_played
  ON game_progress(student_id, last_played_at DESC NULLS LAST);

-- 3. assignments today-missions paths --------------------------------------
-- Queries: features/missions/queries/get-today-missions.ts,
--          features/student-dashboard/server.ts
-- Pattern: WHERE class_id = $1 [or student_id = $1] (often filtered by
-- due_date for "today's" lists). Partial avoids inflating the index with
-- the half of rows where the column is NULL (assignments target either a
-- class OR an individual student, not both).
CREATE INDEX IF NOT EXISTS idx_assignments_class_due_date
  ON assignments(class_id, due_date)
  WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_student_due_date
  ON assignments(student_id, due_date)
  WHERE student_id IS NOT NULL;

-- 4. parent_notifications listing ------------------------------------------
-- Queries: features/parent-portal/queries/get-notifications.ts,
--          app/api/v1/notifications/route.ts
-- Pattern: WHERE parent_id = $1 ORDER BY created_at DESC LIMIT $n.
-- Existing single-column idx_notifications_parent + idx_notifications_created
-- still requires a sort or filter step; this composite is a clean keyset
-- scan.
CREATE INDEX IF NOT EXISTS idx_notifications_parent_created
  ON parent_notifications(parent_id, created_at DESC);

-- 5. child_artifacts listing paths -----------------------------------------
-- Queries: features/portfolio/queries/get-draft-artifacts-for-teacher.ts,
--          features/portfolio/queries/get-family-visible-artifacts-for-child.ts
-- Patterns:
--   (a) WHERE visibility IN ('draft', 'internal_teacher_only')
--       ORDER BY created_at DESC LIMIT $n
--   (b) WHERE student_id = $1 AND visibility = 'family_visible'
--       ORDER BY reviewed_at DESC NULLS LAST, id DESC LIMIT $n
CREATE INDEX IF NOT EXISTS idx_child_artifacts_visibility_created
  ON child_artifacts(visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_child_artifacts_student_visibility_reviewed
  ON child_artifacts(student_id, visibility, reviewed_at DESC NULLS LAST);

-- 6. audit_logs admin user-detail head -------------------------------------
-- Queries: app/api/v1/admin/users/[id]/route.ts (auditHead)
-- Pattern: WHERE changed_by = $1 ORDER BY changed_at DESC LIMIT 5.
-- Existing single-column idx_audit_logs_changed_by needs a sort; the
-- composite supports a direct ordered fetch.
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by_at
  ON audit_logs(changed_by, changed_at DESC);

-- 7. audit_log per-artifact timeline ---------------------------------------
-- Queries (current + foreseeable): "show recent actions on this artifact"
-- Pattern: WHERE artifact_id = $1 ORDER BY created_at DESC LIMIT $n.
CREATE INDEX IF NOT EXISTS idx_audit_log_artifact_created
  ON audit_log(artifact_id, created_at DESC);

-- 8. profiles role filter for admin user list ------------------------------
-- Queries: app/api/v1/admin/users/route.ts
-- Pattern: WHERE role = $1 ORDER BY created_at DESC, id DESC.
-- Roles are a 4-value enum (low cardinality); index helps when the admin
-- filters down to "students" or "teachers".
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles(role);
