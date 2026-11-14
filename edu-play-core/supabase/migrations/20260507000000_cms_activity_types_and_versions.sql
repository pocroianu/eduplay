-- ============================================================================
-- EDU-30.A — CMS Foundation A: activity_types, activity_versions, status, RLS
-- ============================================================================
-- Adds the registry + versioning surface that the rest of the CMS sits on top
-- of. Reversible: tables are new, columns added are nullable (config_data,
-- config_schema_version, version_id) or default-backed (status). Legacy
-- `is_published` boolean on activities is left intact and will be reconciled
-- by EDU-30.B once content has been migrated to config_data + versions.

-- ----------------------------------------------------------------------------
-- 1. activity_types — registry of template renderers
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_types (
  type_id        TEXT PRIMARY KEY
                 CHECK (type_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  display_name   TEXT NOT NULL,
  category       TEXT NOT NULL,
  config_schema  JSONB NOT NULL,
  renderer_key   TEXT NOT NULL,
  version        INT  NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  activity_types IS 'Registry of activity templates. Each row binds a kebab-case type_id to its config JSON Schema (draft-2020-12) and the runtime renderer key.';
COMMENT ON COLUMN activity_types.config_schema IS 'JSON Schema (draft-2020-12) used to validate activity.config_data on the server.';
COMMENT ON COLUMN activity_types.version IS 'Schema version. Bump when config_schema changes in a way that requires migrating existing activities. Activities pin their schema version via activities.config_schema_version.';

DROP TRIGGER IF EXISTS update_activity_types_updated_at ON activity_types;
CREATE TRIGGER update_activity_types_updated_at
  BEFORE UPDATE ON activity_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1a. is_admin() — shared SECURITY DEFINER helper
-- ----------------------------------------------------------------------------
-- Centralizes the admin-role check. Same pattern as get_teacher_class_ids;
-- breaks the implicit cycle (admin policies on profiles would otherwise
-- reference profiles in their own USING clause) and gives every CMS table a
-- single line to maintain when the admin model evolves. Reusable across the
-- CMS surface — activity_types, activity_versions, and EDU-30.B's coming
-- writes will all reference is_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- The registry is read by every render path (admin UI, player, server
-- validation), so reads are public. Writes are admin-only.
DROP POLICY IF EXISTS "Public can read activity_types" ON activity_types;
CREATE POLICY "Public can read activity_types"
  ON activity_types FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage activity_types" ON activity_types;
CREATE POLICY "Admins manage activity_types"
  ON activity_types FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed the 6 templates currently shipping. Matches the Zod enum at
-- src/features/api/schemas/activity.schema.ts so nothing in the existing API
-- breaks at runtime. config_schema is the empty-object schema to start; the
-- real schemas land in EDU-30.B alongside the server validator.
INSERT INTO activity_types (type_id, display_name, category, config_schema, renderer_key)
VALUES
  ('multiple-choice', 'Multiple Choice',  'quiz',     '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'multiple-choice'),
  ('matching-game',   'Matching Game',    'matching', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'matching-game'),
  ('memory-game',     'Memory Game',      'memory',   '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'memory-game'),
  ('categorize-game', 'Categorize Game',  'sorting',  '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'categorize-game'),
  ('sequence-order',  'Sequence Order',   'ordering', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'sequence-order'),
  ('tracing-game',    'Tracing Game',     'creative', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'tracing-game')
ON CONFLICT (type_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. activities — config_data, config_schema_version, status
-- ----------------------------------------------------------------------------

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS config_data            JSONB,
  ADD COLUMN IF NOT EXISTS config_schema_version  INT,
  ADD COLUMN IF NOT EXISTS status                 TEXT
    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'published', 'archived'));

COMMENT ON COLUMN activities.config_data IS 'Live editor draft of the activity config. Validated server-side against activity_types.config_schema. Nullable until EDU-30.B migrates legacy per-template tables.';
COMMENT ON COLUMN activities.config_schema_version IS 'activity_types.version pinned at the time the row was last edited; lets the server detect stale drafts after a schema bump.';
COMMENT ON COLUMN activities.status IS 'CMS lifecycle state. Authoritative for CMS UI. Legacy is_published boolean remains until EDU-30.B reconciles content.';

CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);

-- ----------------------------------------------------------------------------
-- 3. activity_versions — immutable published snapshots
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_versions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id            UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  version_number         INT  NOT NULL CHECK (version_number >= 1),
  config_data            JSONB NOT NULL,
  config_schema_version  INT  NOT NULL,
  published_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (activity_id, version_number)
);

COMMENT ON TABLE  activity_versions IS 'Immutable snapshot of an activity at publish time. Assignments and learner sessions pin to a specific version_id so subsequent edits never alter what a learner already saw.';
COMMENT ON COLUMN activity_versions.config_schema_version IS 'Snapshot of activity_types.version at publish time. Used by the player to load the matching renderer compat layer.';

CREATE INDEX IF NOT EXISTS idx_activity_versions_activity_id_version
  ON activity_versions(activity_id, version_number DESC);

ALTER TABLE activity_versions ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helpers break the policy's reference back to its own
-- relation (otherwise Postgres trips "infinite recursion detected in policy")
-- and decouple the public-read gate from activities RLS.
--
-- Defense-in-depth: gate on BOTH `status = 'published'` (new CMS field) AND
-- the legacy `is_published = TRUE`. During the EDU-30.A → EDU-30.B transition
-- a row could end up with status='published' but is_published=FALSE (or vice
-- versa) while the migration is partial; this AND-gate prevents
-- activity_versions rows from leaking when the parent activity is still
-- invisible to non-admins under the existing activities RLS. EDU-30.B
-- collapses the two columns into one — at that point either side of the AND
-- becomes redundant, but the cost of carrying both during the transition is
-- a single boolean.
CREATE OR REPLACE FUNCTION public.is_activity_published(p_activity_id UUID)
RETURNS BOOLEAN AS $$
  SELECT status = 'published' AND COALESCE(is_published, FALSE)
  FROM public.activities
  WHERE id = p_activity_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

CREATE OR REPLACE FUNCTION public.get_latest_activity_version_number(p_activity_id UUID)
RETURNS INT AS $$
  SELECT MAX(version_number) FROM public.activity_versions WHERE activity_id = p_activity_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Public read: only the latest version of a `published` activity is visible
-- to non-admins. Older snapshots stay private (assignments may still pin to
-- them, but only via service-role server queries).
DROP POLICY IF EXISTS "Public reads latest published activity_version" ON activity_versions;
CREATE POLICY "Public reads latest published activity_version"
  ON activity_versions FOR SELECT
  USING (
    public.is_activity_published(activity_id)
    AND version_number = public.get_latest_activity_version_number(activity_id)
  );

DROP POLICY IF EXISTS "Admins manage activity_versions" ON activity_versions;
CREATE POLICY "Admins manage activity_versions"
  ON activity_versions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Snapshots are immutable by contract. Block UPDATEs at the row level so a
-- buggy client (or a future RLS regression) can't mutate published content.
CREATE OR REPLACE FUNCTION reject_activity_version_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_versions rows are immutable; insert a new version_number instead';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_versions_immutable ON activity_versions;
CREATE TRIGGER activity_versions_immutable
  BEFORE UPDATE ON activity_versions
  FOR EACH ROW EXECUTE FUNCTION reject_activity_version_update();

-- ----------------------------------------------------------------------------
-- 4. assignments — pin to an activity_version
-- ----------------------------------------------------------------------------

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES activity_versions(id) ON DELETE SET NULL;

COMMENT ON COLUMN assignments.version_id IS 'Optional pin to an immutable activity_versions row. Nullable until EDU-30.B/H wire publish-time pinning across teacher and admin flows.';

CREATE INDEX IF NOT EXISTS idx_assignments_version_id ON assignments(version_id);
