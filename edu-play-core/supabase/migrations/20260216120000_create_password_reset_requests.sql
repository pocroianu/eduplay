-- Password reset requests table for rate limiting and security auditing
-- Feature: F1.7 Forgot Password
-- Spec: specs/002-forgot-password.md

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Index for fast rate limit queries (email + time range)
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email_created
  ON password_reset_requests(email, created_at DESC);

-- Index for cleanup queries (find old records)
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created
  ON password_reset_requests(created_at);

-- RLS: Only service role can insert/read (Server Actions use service role or server client)
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert/read (server actions use the admin client)
DROP POLICY IF EXISTS "Service can insert password reset requests" ON password_reset_requests;
CREATE POLICY "Service can insert password reset requests"
  ON password_reset_requests
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can read password reset requests" ON password_reset_requests;
CREATE POLICY "Service can read password reset requests"
  ON password_reset_requests
  FOR SELECT
  TO service_role
  USING (true);

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260216120000''';
  END IF;
END
$wa$;
