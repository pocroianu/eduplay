-- ============================================================================
-- EDU-30.A — CMS schema RLS and immutability tests
-- ----------------------------------------------------------------------------
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(25);

-- ----------------------------------------------------------------------------
-- Schema-level structural assertions
-- ----------------------------------------------------------------------------

SELECT has_table('public', 'activity_types', 'activity_types table exists');
SELECT has_table('public', 'activity_versions', 'activity_versions table exists');

SELECT has_column('public', 'activities', 'config_data', 'activities.config_data added');
SELECT has_column('public', 'activities', 'config_schema_version', 'activities.config_schema_version added');
SELECT has_column('public', 'activities', 'status', 'activities.status added');
SELECT has_column('public', 'assignments', 'version_id', 'assignments.version_id added');

-- All Activity renderer templates seeded
SELECT is(
  (SELECT count(*) FROM activity_types),
  11::bigint,
  'activity_types seeded with all registered template IDs'
);

SELECT bag_eq(
  $$ SELECT type_id::text FROM activity_types $$,
  $$ VALUES ('multiple-choice'),('matching-game'),('memory-game'),('categorize-game'),('sequence-order'),('tracing-game'),('counting-game'),('pattern-game'),('repeat-sequence'),('listen-tap'),('free-response') $$,
  'seed type_ids match the Zod template enum'
);

-- Status default + check constraint
SELECT col_default_is('public', 'activities', 'status', 'draft', 'activities.status defaults to draft');

PREPARE bad_status_insert AS
  INSERT INTO activities (template, title, status)
  VALUES ('multiple-choice', 'x', 'invalid_state');
SELECT throws_ok(
  'bad_status_insert',
  '23514',
  NULL,
  'activities.status check constraint rejects unknown values'
);

-- ----------------------------------------------------------------------------
-- Setup test fixtures (run as service_role / postgres so we bypass RLS)
-- ----------------------------------------------------------------------------

-- Make sure RLS is exercised when we switch roles below.
SET LOCAL row_security = on;

-- Create two profiles: one admin, one non-admin (teacher).
INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cms-admin-test@example.com',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'cms-teacher-test@example.com','00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cms-admin-test@example.com',   'CMS Admin Test',   'admin'),
  ('22222222-2222-2222-2222-222222222222', 'cms-teacher-test@example.com', 'CMS Teacher Test', 'teacher')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Two activities: one published, one draft.
INSERT INTO activities (id, template, title, status, is_published, visibility_scope)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'multiple-choice', 'Pub',   'published', TRUE,  'public'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'multiple-choice', 'Draft', 'draft',     FALSE, 'private');

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '{"v":1}'::jsonb, 1, 'multiple-choice', NULL),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '{"v":2}'::jsonb, 1, 'multiple-choice', NULL),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, '{"v":1}'::jsonb, 1, 'multiple-choice', NULL);

-- ----------------------------------------------------------------------------
-- activity_types RLS
-- ----------------------------------------------------------------------------

-- anon can read the registry
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*) FROM activity_types WHERE type_id = 'multiple-choice'),
  1::bigint,
  'anon can SELECT activity_types'
);

-- non-admin authenticated user cannot write
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';

PREPARE teacher_insert_type AS
  INSERT INTO activity_types (type_id, display_name, category, config_schema, renderer_key)
  VALUES ('teacher-injected', 'Bad', 'quiz', '{}'::jsonb, 'x');
SELECT throws_ok(
  'teacher_insert_type',
  '42501',
  NULL,
  'non-admin INSERT on activity_types is rejected by RLS'
);

-- admin can write
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
INSERT INTO activity_types (type_id, display_name, category, config_schema, renderer_key)
VALUES ('admin-injected', 'OK', 'quiz', '{}'::jsonb, 'x');
SELECT is(
  (SELECT count(*) FROM activity_types WHERE type_id = 'admin-injected'),
  1::bigint,
  'admin INSERT on activity_types succeeds'
);

DELETE FROM activity_types WHERE type_id = 'admin-injected';

-- ----------------------------------------------------------------------------
-- activity_versions RLS
-- ----------------------------------------------------------------------------

-- non-admin: only sees the latest version of published activities
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';

SELECT bag_eq(
  $$ SELECT version_number FROM activity_versions WHERE activity_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') ORDER BY version_number $$,
  $$ VALUES (2) $$,
  'non-admin sees only the latest version of a published activity'
);

-- non-admin cannot write to activity_versions
PREPARE teacher_insert_version AS
  INSERT INTO activity_versions (activity_id, version_number, config_data, config_schema_version, activity_type_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 99, '{}'::jsonb, 1, 'multiple-choice');
SELECT throws_ok(
  'teacher_insert_version',
  '42501',
  NULL,
  'non-admin INSERT on activity_versions is rejected by RLS'
);

-- admin sees everything
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';

SELECT is(
  (SELECT count(*) FROM activity_versions WHERE activity_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')),
  3::bigint,
  'admin sees all activity_versions rows'
);

-- admin can insert new version
INSERT INTO activity_versions (activity_id, version_number, config_data, config_schema_version, activity_type_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, '{"v":3}'::jsonb, 1, 'multiple-choice');

SELECT is(
  (SELECT count(*) FROM activity_versions WHERE activity_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3::bigint,
  'admin INSERT on activity_versions succeeds'
);

-- non-admin now sees the new latest, not the old one
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';

SELECT is(
  (SELECT version_number FROM activity_versions WHERE activity_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' LIMIT 1),
  3,
  'non-admin sees the newest version after admin publishes a higher version_number'
);

-- ----------------------------------------------------------------------------
-- Immutability trigger
-- ----------------------------------------------------------------------------

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';

PREPARE admin_update_version AS
  UPDATE activity_versions
  SET config_data = '{"tampered":true}'::jsonb
  WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
SELECT throws_ok(
  'admin_update_version',
  'P0001',
  'activity_versions rows are immutable; insert a new version_number instead',
  'admin UPDATE on activity_versions is rejected by the immutability trigger'
);

-- ----------------------------------------------------------------------------
-- type_id format constraint
-- ----------------------------------------------------------------------------

PREPARE bad_type_id AS
  INSERT INTO activity_types (type_id, display_name, category, config_schema, renderer_key)
  VALUES ('NotKebab', 'Bad', 'quiz', '{}'::jsonb, 'x');
SELECT throws_ok(
  'bad_type_id',
  '23514',
  NULL,
  'activity_types.type_id rejects non-kebab-case values'
);

-- ----------------------------------------------------------------------------
-- Status enum / version_number unique
-- ----------------------------------------------------------------------------

PREPARE duplicate_version AS
  INSERT INTO activity_versions (activity_id, version_number, config_data, config_schema_version, activity_type_id)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '{}'::jsonb, 1, 'multiple-choice');
SELECT throws_ok(
  'duplicate_version',
  '23505',
  NULL,
  'activity_versions enforces unique (activity_id, version_number)'
);

-- Activity-only assignments require a pinned Activity version.
SELECT col_not_null('public', 'assignments', 'version_id', 'assignments.version_id is required');

-- ----------------------------------------------------------------------------
-- is_admin() helper — returns expected boolean per role
-- ----------------------------------------------------------------------------

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
SELECT is(
  (SELECT public.is_admin()),
  TRUE,
  'is_admin() returns TRUE for an admin profile'
);

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';
SELECT is(
  (SELECT public.is_admin()),
  FALSE,
  'is_admin() returns FALSE for a non-admin (teacher) profile'
);

-- ----------------------------------------------------------------------------
-- is_activity_published() defense-in-depth — status='published' alone is not
-- enough; legacy is_published must also be TRUE and visibility_scope must be
-- public. This prevents activity_versions rows from leaking when the parent
-- activity is not public catalog content.
-- ----------------------------------------------------------------------------

-- Force a partial-migration state: status='published' but is_published=FALSE.
-- Use the postgres role for the UPDATE so we bypass the activities-table RLS
-- (the test fixture is owned by superuser; this just edits the seed row).
RESET "request.jwt.claims";
SET LOCAL ROLE postgres;
UPDATE activities
SET is_published = FALSE
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Switch back to authenticated + non-admin claims so RLS actually engages.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';
SELECT is(
  (SELECT count(*) FROM activity_versions WHERE activity_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'non-admin sees zero activity_versions when status=published but is_published=FALSE (transition guard)'
);

-- Restore for any later assertions.
RESET "request.jwt.claims";
SET LOCAL ROLE postgres;
UPDATE activities
SET is_published = TRUE
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ----------------------------------------------------------------------------
-- Wrap up
-- ----------------------------------------------------------------------------

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;
