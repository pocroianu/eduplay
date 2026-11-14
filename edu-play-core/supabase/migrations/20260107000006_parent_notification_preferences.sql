-- Parent Portal: Notification Preferences
-- This migration creates the parent_notification_preferences table
-- Allows parents to customize which notifications they receive

-- 1. Create parent_notification_preferences table
CREATE TABLE IF NOT EXISTS parent_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_completed BOOLEAN DEFAULT TRUE,
  milestone BOOLEAN DEFAULT TRUE,
  weekly_summary BOOLEAN DEFAULT TRUE,
  achievement BOOLEAN DEFAULT TRUE,
  assignment_due BOOLEAN DEFAULT TRUE,
  assignment_completed BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT FALSE, -- Future: email notifications
  push_notifications BOOLEAN DEFAULT FALSE,  -- Future: push notifications
  digest_frequency TEXT CHECK (digest_frequency IN ('realtime', 'daily', 'weekly')) DEFAULT 'realtime',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_parent_preferences UNIQUE (parent_id)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_prefs_parent ON parent_notification_preferences(parent_id);

-- 3. Enable RLS on parent_notification_preferences
ALTER TABLE parent_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for parent_notification_preferences
-- Parents can view their own preferences
DROP POLICY IF EXISTS "Parents can view their preferences" ON parent_notification_preferences;
CREATE POLICY "Parents can view their preferences" ON parent_notification_preferences
  FOR SELECT USING (parent_id = auth.uid());

-- Parents can insert their preferences (first time setup)
DROP POLICY IF EXISTS "Parents can insert their preferences" ON parent_notification_preferences;
CREATE POLICY "Parents can insert their preferences" ON parent_notification_preferences
  FOR INSERT WITH CHECK (parent_id = auth.uid());

-- Parents can update their own preferences
DROP POLICY IF EXISTS "Parents can update their preferences" ON parent_notification_preferences;
CREATE POLICY "Parents can update their preferences" ON parent_notification_preferences
  FOR UPDATE USING (parent_id = auth.uid());

-- 5. Add updated_at trigger
DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON parent_notification_preferences;
CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON parent_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Create default preferences for existing parents
INSERT INTO parent_notification_preferences (parent_id)
SELECT DISTINCT p.id
FROM profiles p
WHERE p.role = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM parent_notification_preferences pnp
    WHERE pnp.parent_id = p.id
  )
ON CONFLICT (parent_id) DO NOTHING;

-- 7. Add trigger to auto-create preferences for new parents
CREATE OR REPLACE FUNCTION create_parent_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'parent' THEN
    INSERT INTO parent_notification_preferences (parent_id)
    VALUES (NEW.id)
    ON CONFLICT (parent_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_parent_profile_created ON profiles;
CREATE TRIGGER on_parent_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'parent')
  EXECUTE FUNCTION create_parent_notification_preferences();

-- 8. Add comment for documentation
COMMENT ON TABLE parent_notification_preferences IS 'Parent notification preferences for customizing which notifications they receive. Default preferences created automatically on parent signup.';
COMMENT ON COLUMN parent_notification_preferences.game_completed IS 'Notify when child completes a game';
COMMENT ON COLUMN parent_notification_preferences.milestone IS 'Notify when child reaches a learning milestone';
COMMENT ON COLUMN parent_notification_preferences.weekly_summary IS 'Send weekly progress summary';
COMMENT ON COLUMN parent_notification_preferences.achievement IS 'Notify when child earns an achievement';
COMMENT ON COLUMN parent_notification_preferences.assignment_due IS 'Notify when assignment is due soon';
COMMENT ON COLUMN parent_notification_preferences.assignment_completed IS 'Notify when child completes an assignment';
COMMENT ON COLUMN parent_notification_preferences.digest_frequency IS 'How often to send notifications: realtime, daily, or weekly';
COMMENT ON COLUMN parent_notification_preferences.quiet_hours_start IS 'Start time for quiet hours (no notifications)';
COMMENT ON COLUMN parent_notification_preferences.quiet_hours_end IS 'End time for quiet hours';

-- 9. Helper function to check if parent wants notification type
CREATE OR REPLACE FUNCTION should_notify_parent(
  p_parent_id UUID,
  p_notification_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  prefs RECORD;
  check_time TIME;
BEGIN
  -- Get parent preferences (with defaults if not exists)
  SELECT
    COALESCE(game_completed, TRUE) AS game_completed,
    COALESCE(milestone, TRUE) AS milestone,
    COALESCE(weekly_summary, TRUE) AS weekly_summary,
    COALESCE(achievement, TRUE) AS achievement,
    COALESCE(assignment_due, TRUE) AS assignment_due,
    COALESCE(assignment_completed, TRUE) AS assignment_completed,
    quiet_hours_start,
    quiet_hours_end
  INTO prefs
  FROM parent_notification_preferences
  WHERE parent_id = p_parent_id;

  -- If no preferences found, default to TRUE
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Check quiet hours
  check_time := LOCALTIME;
  IF prefs.quiet_hours_start IS NOT NULL AND prefs.quiet_hours_end IS NOT NULL THEN
    IF prefs.quiet_hours_start < prefs.quiet_hours_end THEN
      -- Normal case: 22:00 - 07:00
      IF check_time >= prefs.quiet_hours_start AND check_time <= prefs.quiet_hours_end THEN
        RETURN FALSE;
      END IF;
    ELSE
      -- Wraps midnight: 22:00 - 07:00
      IF check_time >= prefs.quiet_hours_start OR check_time <= prefs.quiet_hours_end THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  -- Check notification type preference
  RETURN CASE p_notification_type
    WHEN 'game_completed' THEN prefs.game_completed
    WHEN 'milestone' THEN prefs.milestone
    WHEN 'weekly_summary' THEN prefs.weekly_summary
    WHEN 'achievement' THEN prefs.achievement
    WHEN 'assignment_due' THEN prefs.assignment_due
    WHEN 'assignment_completed' THEN prefs.assignment_completed
    ELSE TRUE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION should_notify_parent IS 'Check if parent wants to receive a specific notification type (respects preferences and quiet hours)';

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000006''';
  END IF;
END
$wa$;
