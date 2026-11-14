-- F7 Phase 2A — fix child_artifacts RLS to use parent_children junction (EDU-283)
--
-- Background: get_parent_child_ids(parent_uid) was introduced in
-- 20260417100000_child_artifacts_audit_log.sql with a body that only resolves
-- linked children via the legacy students.parent_id column:
--
--   SELECT id FROM students WHERE parent_id = parent_uid;
--
-- The modern parent invite-code flow (`linkParentToChild` server action) writes
-- only to parent_children — it does NOT backfill students.parent_id. So any
-- parent linked through that flow has zero rows visible through the
-- "Parents can view family-visible artifacts" policy and the matching
-- storage.objects policy.
--
-- This migration replaces the function body to read from parent_children. The
-- original parent_children migration (20260107000003_parent_children.sql)
-- already backfilled every existing students.parent_id row into the junction
-- table, so no rows are lost by switching the source.
--
-- Scope: function body only. Signature, volatility, security context, and
-- search_path are preserved so the existing public.child_artifacts and
-- storage.objects policies that reference this function continue to work.
-- students.parent_id is left in place — it is still read by other RLS helpers
-- (e.g. get_parent_student_ids) and removing it is out of scope (deferred).

CREATE OR REPLACE FUNCTION get_parent_child_ids(parent_uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id FROM parent_children
  WHERE parent_id = parent_uid AND status = 'active';
$$;

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260501100000''';
  END IF;
END
$wa$;
