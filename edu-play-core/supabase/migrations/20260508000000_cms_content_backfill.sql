-- ============================================================================
-- EDU-30.B — CMS content backfill: config_data + status + activity_versions v1
-- ============================================================================
-- Companion to EDU-30.A (`20260507000000_cms_activity_types_and_versions.sql`).
-- Reversibility: this migration only writes data. activities.config_data and
-- activities.status defaults already exist; running it twice is a no-op.
--
-- What this does:
--   1. Backfills activities.config_data from existing per-row columns so the
--      Ajv validator (EDU-30.B server side) has a non-null draft for every
--      row, including drafts that never got published.
--   2. Reconciles activities.status with the legacy is_published boolean so
--      the new lifecycle column is authoritative going forward.
--   3. Inserts a v1 activity_versions snapshot for every currently-published
--      activity, frozen against the just-backfilled config_data.
--   4. Asserts pre/post row counts inside the same transaction so the
--      migration aborts cleanly on partial-write conditions.
--
-- Out of scope (recorded as TODO comments below):
--   * Pinning assignments.version_id. Current `assignments.game_id` references
--     `games(id)` (UUID), not `activities(id)`. There is no FK or mapping
--     surface linking the two today; the legacy `games` catalog and the new
--     `activities` CMS table are parallel. Pinning lands when EDU-30.C/D wire
--     a games→activities bridge (or when assignments are migrated onto
--     activities directly).
--   * Dropping legacy per-template tables. Per the EDU-30.B spec, those stay
--     until soak completes after EDU-30.C ships (separate follow-up).

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Lock activities for the duration so concurrent admin writes can't
--    race the backfill. SHARE ROW EXCLUSIVE blocks writers but not readers.
-- ----------------------------------------------------------------------------

LOCK TABLE activities IN SHARE ROW EXCLUSIVE MODE;

-- ----------------------------------------------------------------------------
-- 2. Pre-migration counts. Captured into a temp table so we can assert
--    invariants at the end before the COMMIT. If any assertion fails we ROLLBACK.
-- ----------------------------------------------------------------------------

CREATE TEMP TABLE _edu30b_counts AS
SELECT
  (SELECT count(*) FROM activities)                          AS activities_total,
  (SELECT count(*) FROM activities WHERE is_published)       AS activities_published_legacy,
  (SELECT count(*) FROM activities WHERE config_data IS NULL) AS activities_missing_config_pre,
  (SELECT count(*) FROM activity_versions)                    AS versions_pre;

-- ----------------------------------------------------------------------------
-- 3. Backfill config_data. Encode the row-level fields the legacy templates
--    relied on. The existing config_schema for every type is `{"type":"object"}`
--    (empty schema), so any JSON object validates. The shape we write here is
--    the union the templates already consume in the renderer barrels and
--    matches what EDU-30.C will deepen into per-template required fields.
-- ----------------------------------------------------------------------------

UPDATE activities
SET
  config_data = COALESCE(config_data, jsonb_build_object(
    'gameId',            game_id,
    'language',          default_lang,
    'theme',             default_theme,
    'category',          category,
    'difficulty',        difficulty,
    'targetAgeMin',      target_age_min,
    'targetAgeMax',      target_age_max,
    'estimatedDuration', estimated_duration,
    'questionCount',     question_count,
    'tags',              tags,
    'subject',           subject,
    'skills',            skills
  )),
  config_schema_version = COALESCE(
    config_schema_version,
    (SELECT version FROM activity_types WHERE type_id = activities.template)
  )
-- Touch only rows that still need backfill so a re-run (or a reseed of
-- the legacy boolean) does not fire the update_activities_updated_at
-- trigger on every row and silently rewrite the audit timestamp on
-- rows whose COALESCE result would have been a no-op anyway.
-- Codex P2 review on PR #165.
WHERE config_data IS NULL
   OR config_schema_version IS NULL;

-- Drafts that reference an unknown template still get config_data, but
-- config_schema_version stays NULL. Surface a helpful warning so the operator
-- notices before downstream code chokes on the null.
DO $orphan_check$
DECLARE
  orphan_count BIGINT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM activities
  WHERE template NOT IN (SELECT type_id FROM activity_types);

  IF orphan_count > 0 THEN
    RAISE NOTICE 'EDU-30.B: % activity rows reference templates not registered in activity_types and were left with config_schema_version=NULL. Register the missing types before EDU-30.C ships.', orphan_count;
  END IF;
END
$orphan_check$;

-- ----------------------------------------------------------------------------
-- 4. Reconcile lifecycle status from the legacy is_published boolean.
--    Only touch rows that still hold the default 'draft' so we don't clobber
--    statuses (e.g., 'in_review' / 'archived') an admin already set.
-- ----------------------------------------------------------------------------

UPDATE activities
SET status = 'published'
WHERE is_published = TRUE
  AND status = 'draft';

-- Reverse mirror: if an admin already set status='published' on a row whose
-- legacy is_published is still FALSE (possible on a re-run after manual
-- status edits, or once EDU-30.D's admin UI starts writing status directly),
-- mirror the new lifecycle column back into the legacy flag. Without this,
-- public reads (`is_published = TRUE`) and `is_activity_published()` (status
-- AND is_published) would treat the row as draft even though we're about to
-- snapshot it as v1 below — invisible to learners until something else flips
-- the boolean. Idempotent. Codex P2 review on PR #165.
UPDATE activities
SET is_published = TRUE
WHERE status = 'published'
  AND COALESCE(is_published, FALSE) = FALSE;

-- Forward mirror: the public reads in src/app/api/v1/activities/* and
-- src/app/play/[activityId]/page.tsx still gate visibility solely on
-- `is_published`. If an admin (or EDU-30.D's admin UI) moves a row into
-- `in_review` or `archived` while the legacy flag is still TRUE, the row
-- stays publicly visible despite the lifecycle column saying otherwise.
-- Clear is_published for any non-published row. Idempotent — once both
-- columns agree, the WHERE rejects the row and the trigger never fires.
-- Codex P2 review on PR #165.
UPDATE activities
SET is_published = FALSE
WHERE status <> 'published'
  AND is_published = TRUE;

-- ----------------------------------------------------------------------------
-- 5. Snapshot v1 activity_versions for every currently-published activity
--    that doesn't already have one. Idempotent re-runs are safe because of
--    the WHERE NOT EXISTS guard.
-- ----------------------------------------------------------------------------

INSERT INTO activity_versions (
  activity_id, version_number, config_data, config_schema_version, published_by_user_id
)
SELECT
  a.id,
  1,
  a.config_data,
  COALESCE(a.config_schema_version, 1),
  a.created_by
FROM activities a
WHERE a.status = 'published'
  AND a.config_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_versions v
    WHERE v.activity_id = a.id AND v.version_number = 1
  );

-- ----------------------------------------------------------------------------
-- 6. Post-migration assertions. Roll back if any invariant fails.
-- ----------------------------------------------------------------------------

DO $assertions$
DECLARE
  pre  RECORD;
  missing_config_post     BIGINT;
  published_without_v1    BIGINT;
  versions_post           BIGINT;
  status_legacy_mismatch  BIGINT;
BEGIN
  SELECT * INTO pre FROM _edu30b_counts;

  -- Every non-orphan activity (template in registry) must now have config_data.
  SELECT count(*) INTO missing_config_post
  FROM activities a
  WHERE a.config_data IS NULL
    AND a.template IN (SELECT type_id FROM activity_types);

  IF missing_config_post <> 0 THEN
    RAISE EXCEPTION 'EDU-30.B: % registered-template activities still have NULL config_data after backfill', missing_config_post;
  END IF;

  -- Every published activity must own exactly one v1 snapshot.
  SELECT count(*) INTO published_without_v1
  FROM activities a
  WHERE a.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM activity_versions v
      WHERE v.activity_id = a.id AND v.version_number = 1
    );

  IF published_without_v1 <> 0 THEN
    RAISE EXCEPTION 'EDU-30.B: % published activities are missing a v1 activity_versions snapshot', published_without_v1;
  END IF;

  -- status='published' implies is_published=TRUE so the existing
  -- `is_published`-driven RLS and `is_activity_published()` helper continue
  -- to see the row as visible; status<>'published' implies is_published=FALSE
  -- so non-published rows do NOT leak through reads that still gate on the
  -- legacy boolean. Codex P2 invariant — both directions verified.
  SELECT count(*) INTO status_legacy_mismatch
  FROM activities
  WHERE (status =  'published' AND COALESCE(is_published, FALSE) = FALSE)
     OR (status <> 'published' AND COALESCE(is_published, FALSE) = TRUE);

  IF status_legacy_mismatch <> 0 THEN
    RAISE EXCEPTION 'EDU-30.B: % activities have status/is_published divergence after reconciliation', status_legacy_mismatch;
  END IF;

  -- Versions count must increase by at least the number of newly-promoted
  -- published rows (or stay flat if everything was already snapshotted).
  SELECT count(*) INTO versions_post FROM activity_versions;

  IF versions_post < pre.versions_pre THEN
    RAISE EXCEPTION 'EDU-30.B: activity_versions count decreased (% -> %) — backfill must never delete', pre.versions_pre, versions_post;
  END IF;

  RAISE NOTICE 'EDU-30.B backfill OK: activities=% (published_legacy=%), versions % -> %, config_data nulls % -> 0',
    pre.activities_total,
    pre.activities_published_legacy,
    pre.versions_pre,
    versions_post,
    pre.activities_missing_config_pre;
END
$assertions$;

DROP TABLE _edu30b_counts;

COMMIT;

-- ---------------------------------------------------------------------------
-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- ---------------------------------------------------------------------------
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260508000000''';
  END IF;
END
$wa$;
