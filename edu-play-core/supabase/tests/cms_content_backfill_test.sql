-- ============================================================================
-- Activity-only cutover structural verification
-- ----------------------------------------------------------------------------
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

SELECT hasnt_table('public', 'games', 'legacy games table was removed');
SELECT hasnt_table('public', 'game_progress', 'legacy game_progress table was removed');

SELECT is(
  (SELECT count(*) FROM storage.buckets WHERE id = 'games'),
  0::bigint,
  'legacy games storage bucket was removed'
);

SELECT is(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'games'),
  0::bigint,
  'legacy games storage objects were removed'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        qual ILIKE '%bucket_id%games%'
        OR with_check ILIKE '%bucket_id%games%'
      )
  ),
  0::bigint,
  'legacy games storage policies were removed'
);

SELECT is(
  (SELECT count(*) FROM storage.buckets WHERE id = 'activity-renderers'),
  1::bigint,
  'activity-renderers storage bucket remains active'
);

SELECT hasnt_column('public', 'activities', 'game_id', 'activities.game_id was removed');
SELECT hasnt_column('public', 'assignments', 'game_id', 'assignments.game_id was removed');
SELECT hasnt_column('public', 'activity_progress', 'legacy_game_id', 'activity_progress.legacy_game_id was removed');
SELECT hasnt_column('public', 'learning_path_steps', 'target_game_id', 'learning_path_steps.target_game_id was removed');

SELECT col_not_null('public', 'assignments', 'activity_id', 'assignments.activity_id is required');
SELECT col_not_null('public', 'assignments', 'version_id', 'assignments.version_id is required');

SELECT fk_ok(
  'public', 'assignments', 'activity_id',
  'public', 'activities', 'id',
  'assignments.activity_id references activities.id'
);

SELECT fk_ok(
  'public', 'assignments', 'version_id',
  'public', 'activity_versions', 'id',
  'assignments.version_id references activity_versions.id'
);

PREPARE insert_game_step AS
  INSERT INTO learning_path_steps (path_id, step_order, kind, target_activity_type, title)
  VALUES ('00000000-0000-4000-8000-000000000001', 0, 'game', 'multiple-choice', 'legacy game step');
SELECT throws_ok(
  'insert_game_step',
  '23514',
  NULL,
  'learning_path_steps rejects legacy game steps'
);

PREPARE insert_unbound_activity_step AS
  INSERT INTO learning_path_steps (path_id, step_order, kind, target_activity_type, title)
  VALUES ('00000000-0000-4000-8000-000000000001', 0, 'activity_template', NULL, 'missing type');
SELECT throws_ok(
  'insert_unbound_activity_step',
  '23514',
  NULL,
  'learning_path_steps requires target_activity_type for Activity steps'
);

SELECT results_eq(
  $$ SELECT COALESCE(bool_and(kind <> 'game'), TRUE) FROM learning_path_steps $$,
  $$ VALUES (TRUE::boolean) $$,
  'learning_path_steps no longer contain game steps'
);

SELECT * FROM finish();

ROLLBACK;
