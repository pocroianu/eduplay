-- Parent Portal: Notification System
-- This migration creates the parent_notifications table for in-app notifications
-- Supports real-time updates via Supabase Realtime

-- 1. Create parent_notifications table
CREATE TABLE IF NOT EXISTS parent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('game_completed', 'milestone', 'weekly_summary', 'achievement', 'assignment_due', 'assignment_completed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Additional structured data (game_id, score, etc.)
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_parent ON parent_notifications(parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_student ON parent_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON parent_notifications(parent_id, read_at)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON parent_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON parent_notifications(type);

-- 3. Enable RLS on parent_notifications
ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for parent_notifications
-- Parents can view their own notifications
DROP POLICY IF EXISTS "Parents can view their notifications" ON parent_notifications;
CREATE POLICY "Parents can view their notifications" ON parent_notifications
  FOR SELECT USING (parent_id = auth.uid());

-- Parents can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Parents can update their notifications" ON parent_notifications;
CREATE POLICY "Parents can update their notifications" ON parent_notifications
  FOR UPDATE USING (parent_id = auth.uid());

-- Service role can insert notifications (for triggers and server actions)
DROP POLICY IF EXISTS "Service role can insert notifications" ON parent_notifications;
CREATE POLICY "Service role can insert notifications" ON parent_notifications
  FOR INSERT WITH CHECK (true);

-- Parents can delete their own notifications
DROP POLICY IF EXISTS "Parents can delete their notifications" ON parent_notifications;
CREATE POLICY "Parents can delete their notifications" ON parent_notifications
  FOR DELETE USING (parent_id = auth.uid());

-- 5. Enable Supabase Realtime for parent_notifications
-- This allows real-time subscription to new notifications
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'parent_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE parent_notifications;
  END IF;
END
$pub$;

-- 6. Add comment for documentation
COMMENT ON TABLE parent_notifications IS 'In-app notifications for parents about their children''s progress. Supports real-time updates via Supabase Realtime.';
COMMENT ON COLUMN parent_notifications.type IS 'Notification type: game_completed, milestone, weekly_summary, achievement, assignment_due, assignment_completed';
COMMENT ON COLUMN parent_notifications.data IS 'Additional structured data (JSONB): game_id, score, time_spent, achievement_id, etc.';
COMMENT ON COLUMN parent_notifications.read_at IS 'Timestamp when notification was marked as read (NULL = unread)';

-- 7. Create helper function to send notification to all linked parents
CREATE OR REPLACE FUNCTION notify_linked_parents(
  p_student_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  -- Insert notification for each active parent link
  INSERT INTO parent_notifications (parent_id, student_id, type, title, message, data)
  SELECT
    pc.parent_id,
    p_student_id,
    p_type,
    p_title,
    p_message,
    p_data
  FROM parent_children pc
  WHERE pc.student_id = p_student_id
    AND pc.status = 'active'
  UNION
  -- Also check students.parent_id for backward compatibility
  SELECT
    s.parent_id,
    p_student_id,
    p_type,
    p_title,
    p_message,
    p_data
  FROM students s
  WHERE s.id = p_student_id
    AND s.parent_id IS NOT NULL
    AND NOT EXISTS (
      -- Avoid duplicates if already in parent_children
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = s.parent_id
        AND pc.student_id = s.id
        AND pc.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_linked_parents IS 'Helper function to send notification to all parents linked to a student (both via junction table and legacy parent_id)';

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000005''';
  END IF;
END
$wa$;
