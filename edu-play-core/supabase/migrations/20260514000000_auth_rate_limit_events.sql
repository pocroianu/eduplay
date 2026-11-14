-- Auth rate limit events for login and student PIN brute-force protection.
-- Service-role only: server actions write/query this table; clients never access it.

CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_events_identifier_created
  ON auth_rate_limit_events(identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_events_created
  ON auth_rate_limit_events(created_at);

ALTER TABLE auth_rate_limit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can insert auth rate limit events" ON auth_rate_limit_events;
CREATE POLICY "Service can insert auth rate limit events"
  ON auth_rate_limit_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can read auth rate limit events" ON auth_rate_limit_events;
CREATE POLICY "Service can read auth rate limit events"
  ON auth_rate_limit_events
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service can delete auth rate limit events" ON auth_rate_limit_events;
CREATE POLICY "Service can delete auth rate limit events"
  ON auth_rate_limit_events
  FOR DELETE
  TO service_role
  USING (true);

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260514000000''';
  END IF;
END
$wa$;
