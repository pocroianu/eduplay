-- ============================================================================
-- EDU-533 — CMS lifecycle hardening (follow-up to EDU-30.A / PR #158)
-- ----------------------------------------------------------------------------
-- Two defense-in-depth fixes that the foundational schema in
-- 20260507000000_cms_activity_types_and_versions.sql intentionally deferred:
--
--   1. Lock down activities lifecycle columns (status, config_data,
--      config_schema_version) so a teacher hitting Supabase directly cannot
--      flip them. The existing teacher RLS on activities is FOR ALL with no
--      column restriction; we close that gap with a BEFORE UPDATE trigger
--      because Postgres RLS WITH CHECK cannot compare OLD vs NEW values
--      (only the post-update row is visible to WITH CHECK).
--
--   2. Pin the renderer on activity_versions itself so a published version
--      stays renderer-stable even if activities.template is later edited.
--      Adds activity_type_id (FK to activity_types), backfills from
--      activities.template, then enforces NOT NULL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trigger-based column gate on activities (Finding 1)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_admin_only_lifecycle_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role / postgres bypass: auth.uid() is NULL when called outside an
  -- authenticated request (server actions using the service-role key, SQL
  -- migrations, supabase CLI). Those callers are trusted by RLS already.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- INSERT path: enforce schema defaults on lifecycle columns. The existing
  -- 20260413 teacher RLS policy is FOR ALL, so without this gate a teacher
  -- could create a row with status='published' / non-NULL config_data /
  -- non-NULL config_schema_version directly via PostgREST, bypassing the
  -- UPDATE branch entirely. Defaults: status='draft' (NOT NULL DEFAULT),
  -- config_data NULL (nullable, no default), config_schema_version NULL.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'activities.status is admin-only on insert (must be ''draft'')'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.config_data IS NOT NULL THEN
      RAISE EXCEPTION 'activities.config_data is admin-only on insert (must be NULL)'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.config_schema_version IS NOT NULL THEN
      RAISE EXCEPTION 'activities.config_schema_version is admin-only on insert (must be NULL)'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE path: reject any change to a lifecycle column.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'activities.status is admin-only (CMS lifecycle column)'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.config_data IS DISTINCT FROM OLD.config_data THEN
    RAISE EXCEPTION 'activities.config_data is admin-only (CMS lifecycle column)'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.config_schema_version IS DISTINCT FROM OLD.config_schema_version THEN
    RAISE EXCEPTION 'activities.config_schema_version is admin-only (CMS lifecycle column)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS activities_lifecycle_columns_admin_only ON activities;
CREATE TRIGGER activities_lifecycle_columns_admin_only
  BEFORE INSERT OR UPDATE OF status, config_data, config_schema_version ON activities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_only_lifecycle_columns();

COMMENT ON FUNCTION public.enforce_admin_only_lifecycle_columns() IS
  'Defense-in-depth gate for CMS lifecycle columns on activities. Phase 2A keeps CMS authoring admin-only; the existing teacher RLS policy on activities is FOR ALL with no per-column restriction, so a teacher hitting Supabase directly could otherwise INSERT with status=''published''/non-NULL config_* or UPDATE existing rows to flip status/config_data/config_schema_version. EDU-533.';

-- ----------------------------------------------------------------------------
-- 2. Pin renderer on activity_versions (Finding 2)
-- ----------------------------------------------------------------------------

ALTER TABLE activity_versions
  ADD COLUMN IF NOT EXISTS activity_type_id TEXT REFERENCES activity_types(type_id);

-- The existing activity_versions_immutable BEFORE UPDATE trigger from
-- 20260507000000 unconditionally RAISEs on every update — it is the
-- runtime contract for snapshot immutability. The backfill below is the
-- one legitimate exception: a one-shot data migration setting a column
-- that did not exist when the prior rows were written. Disable the
-- trigger only while this UPDATE runs and re-enable it before the
-- migration commits, so the immutability invariant holds for every
-- subsequent transaction. ALTER TABLE inside a transaction is
-- transactionally rolled back on failure, so a failed backfill leaves
-- the trigger in its enabled state.
ALTER TABLE activity_versions DISABLE TRIGGER activity_versions_immutable;

-- Backfill from activities.template. activities.template is the kebab-case
-- type_id today (matches the seeded activity_types rows). Any row with a
-- template that no longer exists in activity_types is left NULL — the SET
-- NOT NULL below will fail loudly if that ever happens, surfacing the
-- inconsistency instead of silently dropping the FK constraint.
UPDATE activity_versions av
SET activity_type_id = a.template
FROM activities a
WHERE av.activity_id = a.id
  AND av.activity_type_id IS NULL
  AND EXISTS (SELECT 1 FROM activity_types t WHERE t.type_id = a.template);

ALTER TABLE activity_versions ENABLE TRIGGER activity_versions_immutable;

ALTER TABLE activity_versions
  ALTER COLUMN activity_type_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_versions_activity_type_id
  ON activity_versions(activity_type_id);

COMMENT ON COLUMN activity_versions.activity_type_id IS
  'Renderer pin for the snapshot. Resolved through activity_types.renderer_key by the player so a published version is renderer-stable even if activities.template is later edited. Set on insert; immutable via the existing activity_versions immutability trigger.';
