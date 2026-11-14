-- Data-subject rights: deletion_requests table
-- Tracks GDPR Art.17 erasure requests with 30-day grace period.
-- Users can cancel during the window. See PRIVACY.md section 6.

CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cancelled', 'completed')) DEFAULT 'pending',
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_deletion_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one pending deletion request per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_deletion_requests_one_pending
  ON deletion_requests(user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_deletion_requests_pending_schedule
  ON deletion_requests(status, scheduled_deletion_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
  ON deletion_requests(user_id);

-- RLS
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deletion requests" ON deletion_requests;
CREATE POLICY "Users can view own deletion requests" ON deletion_requests
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own deletion requests" ON deletion_requests;
CREATE POLICY "Users can create own deletion requests" ON deletion_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('teacher', 'parent', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can cancel own deletion requests" ON deletion_requests;
CREATE POLICY "Users can cancel own deletion requests" ON deletion_requests
  FOR UPDATE USING (
    user_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Service can manage deletion requests" ON deletion_requests;
CREATE POLICY "Service can manage deletion requests" ON deletion_requests
  FOR ALL TO service_role USING (true);

-- updated_at trigger (reuses existing function from initial schema)
DROP TRIGGER IF EXISTS update_deletion_requests_updated_at ON deletion_requests;
CREATE TRIGGER update_deletion_requests_updated_at
  BEFORE UPDATE ON deletion_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE deletion_requests IS 'GDPR Art.17 erasure requests with 30-day grace period. Users can cancel during the window.';

-- Supabase CLI dedup workaround
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE format('DELETE FROM supabase_migrations.schema_migrations WHERE version = %L', '20260417000000');
  END IF;
END
$wa$;
