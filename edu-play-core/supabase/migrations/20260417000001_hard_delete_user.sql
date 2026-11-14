-- GDPR hard-delete function for deferred account purge.
-- Called by a scheduled job (pg_cron / edge function) after the 30-day grace period.
-- SECURITY DEFINER + service_role only.
--
-- Cascade chain: auth.users -> profiles -> classes/students/parent_children/etc.
-- Non-cascading refs (parent_invite_codes.used_by) are cleared manually before delete.
-- password_reset_requests has no FK — cleaned by email match.
--
-- Note: deletion_requests rows are also CASCADE-deleted when profiles are removed.
-- The function return value serves as the immediate audit trail. A dedicated
-- deletion_audit_log table is a follow-up if permanent records are needed.

CREATE OR REPLACE FUNCTION execute_pending_deletions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_request RECORD;
BEGIN
  FOR v_request IN
    SELECT dr.id, dr.user_id, p.email
    FROM deletion_requests dr
    JOIN profiles p ON p.id = dr.user_id
    WHERE dr.status = 'pending'
      AND dr.scheduled_deletion_at <= NOW()
    FOR UPDATE OF dr SKIP LOCKED
  LOOP
    -- Clear non-cascading FK references
    UPDATE parent_invite_codes SET used_by = NULL WHERE used_by = v_request.user_id;

    -- Delete password reset requests (no FK, matched by email)
    DELETE FROM password_reset_requests WHERE email = v_request.email;

    -- Delete from auth.users — cascades to profiles and all FK-linked tables
    DELETE FROM auth.users WHERE id = v_request.user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION execute_pending_deletions IS 'Executes matured GDPR deletion requests. Call via cron or edge function. Returns count of deleted users.';

-- SECURITY DEFINER functions inherit PUBLIC execute by default. Restrict to service_role
-- so no authenticated end-user can trigger a mass hard-delete via PostgREST/RPC.
REVOKE EXECUTE ON FUNCTION execute_pending_deletions() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION execute_pending_deletions() TO service_role;

-- Supabase CLI dedup workaround
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE format('DELETE FROM supabase_migrations.schema_migrations WHERE version = %L', '20260417000001');
  END IF;
END
$wa$;
