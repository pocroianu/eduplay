-- EDU-67: Admin backend foundations
-- 1. profiles.status column (active/suspended) for admin user-status PATCH
-- 2. feature_flags + feature_flag_events tables
-- 3. audit_logs schema extension to support recordAdminAction()
-- 4. Seed `game_builder_beta` flag

-- ---------------------------------------------------------------------------
-- 0. profiles.status — backs PATCH /api/v1/admin/users/:id { status }
--    Default 'active' keeps every existing row safe.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON profiles(status) WHERE status <> 'active';

-- ---------------------------------------------------------------------------
-- 1. feature_flags
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feature_flags (
  name        TEXT PRIMARY KEY,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  targeting   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read feature_flags" ON feature_flags;
CREATE POLICY "Admins read feature_flags" ON feature_flags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins write feature_flags" ON feature_flags;
CREATE POLICY "Admins write feature_flags" ON feature_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. feature_flag_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feature_flag_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name  TEXT NOT NULL REFERENCES feature_flags(name) ON DELETE CASCADE,
  actor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action     TEXT NOT NULL CHECK (action IN (
    'created',
    'enabled',
    'disabled',
    'targeting_changed',
    'description_changed',
    'deleted'
  )),
  before     JSONB,
  after      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_flag_events_flag_name_idx
  ON feature_flag_events(flag_name, created_at DESC);

ALTER TABLE feature_flag_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read feature_flag_events" ON feature_flag_events;
CREATE POLICY "Admins read feature_flag_events" ON feature_flag_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Inserts are made by the server via the service-role client; no
-- user-facing INSERT/UPDATE/DELETE policies are required.

-- ---------------------------------------------------------------------------
-- 3. audit_logs schema extension (admin-action support)
--    Existing trigger writes (operation IN INSERT/UPDATE/DELETE; record_id UUID)
--    keep working unchanged. New nullable columns let recordAdminAction()
--    write higher-level admin actions against TEXT-keyed resources.
-- ---------------------------------------------------------------------------

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT,
  ADD COLUMN IF NOT EXISTS resource_id_text TEXT;

ALTER TABLE audit_logs
  ALTER COLUMN record_id DROP NOT NULL;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_operation_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_operation_check
  CHECK (operation IS NULL OR operation IN ('INSERT', 'UPDATE', 'DELETE'));

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_resource_id_present
  CHECK (record_id IS NOT NULL OR resource_id_text IS NOT NULL);

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_admin_row_has_action
  CHECK (operation IS NOT NULL OR action IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action) WHERE action IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id_text
  ON audit_logs(resource_id_text) WHERE resource_id_text IS NOT NULL;

COMMENT ON COLUMN audit_logs.action IS
  'High-level action label for admin-driven mutations (e.g. flag_enabled, user_suspended). Null for trigger-generated rows.';
COMMENT ON COLUMN audit_logs.visibility IS
  'Audit visibility scope: ''platform'', ''family'', ''internal''. Null for trigger-generated rows.';
COMMENT ON COLUMN audit_logs.resource_id_text IS
  'Text-keyed resource id for resources whose primary key is not a UUID (e.g. feature_flags.name).';

-- ---------------------------------------------------------------------------
-- 4. Seed game_builder_beta so QA has a non-empty flag list to render.
-- ---------------------------------------------------------------------------

INSERT INTO feature_flags (name, description, enabled, targeting)
VALUES (
  'game_builder_beta',
  'Internal beta gate for the game-builder admin page.',
  FALSE,
  '{}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- ---------------------------------------------------------------------------
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260426150000''';
  END IF;
END
$wa$;
