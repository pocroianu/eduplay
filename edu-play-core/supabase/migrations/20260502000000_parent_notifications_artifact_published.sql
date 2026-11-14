-- F6 Phase 1E: Add `artifact_published` to parent_notifications.type
-- Wires the teacher publish flow (EDU-274) to the parent activity feed (EDU-275).
-- Pattern mirrors the constraint-rewrite used in 20260426150000_admin_feature_flags.sql.

ALTER TABLE parent_notifications
  DROP CONSTRAINT IF EXISTS parent_notifications_type_check;

ALTER TABLE parent_notifications
  ADD CONSTRAINT parent_notifications_type_check
  CHECK (
    type IN (
      'game_completed',
      'milestone',
      'weekly_summary',
      'achievement',
      'assignment_due',
      'assignment_completed',
      'artifact_published'
    )
  );

COMMENT ON COLUMN parent_notifications.type IS
  'Notification type: game_completed, milestone, weekly_summary, achievement, assignment_due, assignment_completed, artifact_published';
